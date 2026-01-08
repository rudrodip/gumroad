import * as React from "react";

import { ContentTab } from "$app/components/ProductEdit/ContentTab";
import { ProductEditProvider } from "$app/components/ProductEdit/Provider";

export default function ContentPage() {
  return (
    <ProductEditProvider>
      <ContentTab currentTab="content" />
    </ProductEditProvider>
  );
}
