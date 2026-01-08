import * as React from "react";

import { ProductTab } from "$app/components/ProductEdit/ProductTab";
import { ProductEditProvider } from "$app/components/ProductEdit/Provider";

export default function ProductPage() {
  return (
    <ProductEditProvider>
      <ProductTab currentTab="product" />
    </ProductEditProvider>
  );
}
