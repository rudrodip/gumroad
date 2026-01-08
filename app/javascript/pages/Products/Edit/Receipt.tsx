import * as React from "react";

import { ProductEditProvider } from "$app/components/ProductEdit/Provider";
import { ReceiptTab } from "$app/components/ProductEdit/ReceiptTab";

export default function ReceiptPage() {
  return (
    <ProductEditProvider>
      <ReceiptTab currentTab="receipt" />
    </ProductEditProvider>
  );
}
