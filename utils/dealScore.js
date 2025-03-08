function calculateDealScore(item) {
  const score = {
    priceScore: compareToPriceHistory(item.price),
    conditionScore: evaluateCondition(item.condition),
    sellerScore: assessSellerRating(item.seller),
    shippingScore: calculateShippingValue(item.shipping)
  };
  return computeFinalScore(score);
}
