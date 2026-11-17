export async function createProductWithBatch(send, product, batch, productId, onCreated) {
  if (!productId) {
    const created = await send("/api/products", { method: "POST", body: product });
    productId = created.product_id;
    onCreated(productId);
  }
  if (batch) {
    await send("/api/inventory-batches", {
      method: "POST",
      body: {
        ...batch,
        product_id: productId,
        manufactured_on: batch.manufactured_on || null,
        received_on: batch.received_on || undefined,
        notes: batch.notes || null,
      },
    });
  }
}
