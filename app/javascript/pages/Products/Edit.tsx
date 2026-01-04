import { usePage } from "@inertiajs/react";
import React from "react";

import ProductEditPage, { type Props } from "$app/components/server-components/ProductEditPage";

function Edit() {
  const { edit_props, dropbox_app_key } = usePage<{ edit_props: Props; dropbox_app_key: string | null }>().props;
  return <ProductEditPage {...edit_props} dropbox_app_key={dropbox_app_key} />;
}

export default Edit;
