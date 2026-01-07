import { useForm, usePage } from "@inertiajs/react";
import { DirectUpload } from "@rails/activestorage";
import isEqual from "lodash/isEqual";
import * as React from "react";
import { cast } from "ts-safe-cast";

import { OtherRefundPolicy } from "$app/data/products/other_refund_policies";
import { Thumbnail } from "$app/data/thumbnails";
import { RatingsWithPercentages } from "$app/parsers/product";
import { CurrencyCode } from "$app/utils/currency";
import { Taxonomy } from "$app/utils/discover";
import { ALLOWED_EXTENSIONS } from "$app/utils/file";
import { assertResponseError, request } from "$app/utils/request";

import { Seller } from "$app/components/Product";
import { ContentTab } from "$app/components/ProductEdit/ContentTab";
import { getDownloadUrl } from "$app/components/ProductEdit/ContentTab/FileEmbed";
import { Page } from "$app/components/ProductEdit/ContentTab/PageTab";
import { FileEmbed } from "$app/components/ProductEdit/ContentTab/FileEmbed";
import { extensions } from "$app/components/ProductEdit/ContentTab";
import { type ProductEditTab } from "$app/components/ProductEdit/Layout";
import { ProductTab } from "$app/components/ProductEdit/ProductTab";
import { ReceiptTab } from "$app/components/ProductEdit/ReceiptTab";
import { RefundPolicy } from "$app/components/ProductEdit/RefundPolicy";
import { ShareTab } from "$app/components/ProductEdit/ShareTab";
import {
  ProductEditContext,
  Product,
  ProfileSection,
  ExistingFileEntry,
  ShippingCountry,
  ContentUpdates,
} from "$app/components/ProductEdit/state";
import { ImageUploadSettingsContext, baseEditorOptions } from "$app/components/RichTextEditor";
import { showAlert } from "$app/components/server-components/Alert";
import { Editor, findChildren } from "@tiptap/core";

type PageProps = {
  edit_props: {
    product: Product;
    id: string;
    unique_permalink: string;
    thumbnail: Thumbnail | null;
    refund_policies: OtherRefundPolicy[];
    currency_type: CurrencyCode;
    is_tiered_membership: boolean;
    is_listed_on_discover: boolean;
    is_physical: boolean;
    profile_sections: ProfileSection[];
    taxonomies: Taxonomy[];
    earliest_membership_price_change_date: string;
    custom_domain_verification_status: { success: boolean; message: string } | null;
    sales_count_for_inventory: number;
    successful_sales_count: number;
    ratings: RatingsWithPercentages;
    seller: Seller;
    existing_files: ExistingFileEntry[];
    aws_key: string;
    s3_url: string;
    available_countries: ShippingCountry[];
    google_client_id: string;
    google_calendar_enabled: boolean;
    seller_refund_policy_enabled: boolean;
    seller_refund_policy: Pick<RefundPolicy, "title" | "fine_print">;
    cancellation_discounts_enabled: boolean;
  };
  dropbox_app_key: string | null;
  current_tab: ProductEditTab;
};

const pagesHaveSameContent = (pages1: Page[], pages2: Page[]): boolean => isEqual(pages1, pages2);

const findUpdatedContent = (product: Product, lastSavedProduct: Product) => {
  const contentUpdatedVariantIds = product.variants
    .filter((variant) => {
      const lastSavedVariant = lastSavedProduct.variants.find((v) => v.id === variant.id);
      return !pagesHaveSameContent(variant.rich_content, lastSavedVariant?.rich_content ?? []);
    })
    .map((variant) => variant.id);

  const sharedContentUpdated = !pagesHaveSameContent(product.rich_content, lastSavedProduct.rich_content);

  return {
    sharedContentUpdated,
    contentUpdatedVariantIds,
  };
};

function Edit() {
  const { edit_props, dropbox_app_key, current_tab } = usePage<PageProps>().props;

  const [product, setProduct] = React.useState(edit_props.product);
  const [contentUpdates, setContentUpdates] = React.useState<ContentUpdates>(null);
  const [currencyType, setCurrencyType] = React.useState<CurrencyCode>(edit_props.currency_type);
  const lastSavedProductRef = React.useRef<Product>(structuredClone(edit_props.product));
  const [existingFiles, setExistingFiles] = React.useState(edit_props.existing_files);

  const updateProduct = (update: Partial<Product> | ((product: Product) => void)) =>
    setProduct((prevProduct) => {
      const updated = { ...prevProduct };
      if (typeof update === "function") update(updated);
      else Object.assign(updated, update);
      return updated;
    });

  // Inertia form for submissions
  const form = useForm({});

  const [imagesUploading, setImagesUploading] = React.useState<Set<File>>(new Set());

  const save = async () => {
    // Prepare product data - filter files based on rich content
    const editor = new Editor(baseEditorOptions(extensions(edit_props.id)));
    const richContents =
      product.has_same_rich_content_for_all_variants || !product.variants.length
        ? product.rich_content
        : product.variants.flatMap((variant) => variant.rich_content);
    const fileIds = new Set(
      richContents.flatMap((content) =>
        findChildren(
          editor.schema.nodeFromJSON(content.description),
          (node) => node.type.name === FileEmbed.name,
        ).map<unknown>((child) => child.node.attrs.id),
      ),
    );
    editor.destroy();

    const filteredProduct = {
      ...product,
      files: product.files.filter((file) => fileIds.has(file.id)),
    };

    // Transform and submit using Inertia
    form.transform(() => ({
      ...filteredProduct,
      price_currency_type: currencyType,
      covers: filteredProduct.covers.map(({ id }) => id),
      variants: filteredProduct.variants.map(({ newlyAdded, ...variant }) =>
        newlyAdded ? { ...variant, id: null } : variant,
      ),
      availabilities: filteredProduct.availabilities.map(({ newlyAdded, ...availability }) =>
        newlyAdded ? { ...availability, id: null } : availability,
      ),
      installment_plan: filteredProduct.allow_installment_plan ? filteredProduct.installment_plan : null,
    }));

    return new Promise<void>((resolve, reject) => {
      form.post(Routes.link_path(edit_props.unique_permalink), {
        preserveScroll: true,
        preserveState: true,
        onSuccess: (page) => {
          const flash = (page.props as { flash?: { warning?: string; alert?: string; notice?: string } }).flash;

          if (flash?.warning) {
            showAlert(flash.warning, "warning");
          } else {
            const { contentUpdatedVariantIds, sharedContentUpdated } = findUpdatedContent(
              product,
              lastSavedProductRef.current,
            );
            const contentUpdated = sharedContentUpdated || contentUpdatedVariantIds.length > 0;

            if (edit_props.successful_sales_count > 0 && contentUpdated) {
              const uniquePermalinkOrVariantIds = product.has_same_rich_content_for_all_variants
                ? [edit_props.unique_permalink]
                : contentUpdatedVariantIds;

              setContentUpdates({
                uniquePermalinkOrVariantIds,
              });
            } else {
              showAlert("Changes saved!", "success");
            }
            lastSavedProductRef.current = structuredClone(product);
          }
          resolve();
        },
        onError: (errors) => {
          const errorMessage = Object.values(errors)[0] || "Something went wrong";
          showAlert(errorMessage, "error");
          reject(new Error(errorMessage));
        },
      });
    });
  };

  const contextValue = React.useMemo(
    () => ({
      id: edit_props.id,
      product,
      updateProduct,
      uniquePermalink: edit_props.unique_permalink,
      refundPolicies: edit_props.refund_policies,
      thumbnail: edit_props.thumbnail,
      currencyType,
      setCurrencyType,
      isListedOnDiscover: edit_props.is_listed_on_discover,
      isPhysical: edit_props.is_physical,
      profileSections: edit_props.profile_sections,
      taxonomies: edit_props.taxonomies,
      earliestMembershipPriceChangeDate: new Date(edit_props.earliest_membership_price_change_date),
      customDomainVerificationStatus: edit_props.custom_domain_verification_status,
      salesCountForInventory: edit_props.sales_count_for_inventory,
      successfulSalesCount: edit_props.successful_sales_count,
      ratings: edit_props.ratings,
      seller: edit_props.seller,
      existingFiles,
      setExistingFiles,
      awsKey: edit_props.aws_key,
      s3Url: edit_props.s3_url,
      availableCountries: edit_props.available_countries,
      saving: form.processing,
      save,
      googleClientId: edit_props.google_client_id,
      googleCalendarEnabled: edit_props.google_calendar_enabled,
      seller_refund_policy_enabled: edit_props.seller_refund_policy_enabled,
      seller_refund_policy: edit_props.seller_refund_policy,
      cancellationDiscountsEnabled: edit_props.cancellation_discounts_enabled,
      dropboxAppKey: dropbox_app_key,
      contentUpdates,
      setContentUpdates,
      filesById: new Map(
        product.files.map((file) => [file.id, { ...file, url: getDownloadUrl(edit_props.id, file) }]),
      ),
    }),
    [product, existingFiles, currencyType, form.processing, contentUpdates, dropbox_app_key],
  );

  const imageSettings = React.useMemo(
    () => ({
      isUploading: imagesUploading.size > 0,
      onUpload: (file: File) => {
        setImagesUploading((prev) => new Set(prev).add(file));
        return new Promise<string>((resolve, reject) => {
          const upload = new DirectUpload(file, Routes.rails_direct_uploads_path());
          upload.create((error, blob) => {
            setImagesUploading((prev) => {
              const updated = new Set(prev);
              updated.delete(file);
              return updated;
            });

            if (error) reject(error);
            else
              request({
                method: "GET",
                accept: "json",
                url: Routes.s3_utility_cdn_url_for_blob_path({ key: blob.key }),
              })
                .then((response) => response.json())
                .then((data) => resolve(cast<{ url: string }>(data).url))
                .catch((e: unknown) => {
                  assertResponseError(e);
                  reject(e);
                });
          });
        });
      },
      allowedExtensions: ALLOWED_EXTENSIONS,
    }),
    [imagesUploading.size],
  );

  const renderTabContent = () => {
    switch (current_tab) {
      case "product":
        return <ProductTab currentTab={current_tab} />;
      case "content":
        return <ContentTab currentTab={current_tab} />;
      case "receipt":
        return <ReceiptTab currentTab={current_tab} />;
      case "share":
        return <ShareTab currentTab={current_tab} />;
      default:
        return <ProductTab currentTab="product" />;
    }
  };

  return (
    <ProductEditContext.Provider value={contextValue}>
      <ImageUploadSettingsContext.Provider value={imageSettings}>
        {renderTabContent()}
      </ImageUploadSettingsContext.Provider>
    </ProductEditContext.Provider>
  );
}

export default Edit;
