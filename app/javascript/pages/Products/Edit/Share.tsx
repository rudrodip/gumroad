import * as React from "react";

import { ProductEditProvider } from "$app/components/ProductEdit/Provider";
import { ShareTab } from "$app/components/ProductEdit/ShareTab";

export default function SharePage() {
  return (
    <ProductEditProvider>
      <ShareTab currentTab="share" />
    </ProductEditProvider>
  );
}
