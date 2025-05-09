export interface SubscriptionPlan {
  productId: string;
  creditsGranted: number;
  durationDays: number;
}

export const subscriptionPlans: Record<string, SubscriptionPlan> = {
  toonify_pro_weekly: {
    productId: 'toonify_pro_weekly',
    creditsGranted: 50,
    durationDays: 7,
  },
  toonify_pro_monthly: {
    productId: 'toonify_pro_monthly',
    creditsGranted: 200,
    durationDays: 30,
  },
  toonify_pro_yearly: {
    productId: 'toonify_pro_yearly',
    creditsGranted: 1000,
    durationDays: 365,
  },
};

export const getSubscriptionPlan = (productId: string): SubscriptionPlan | undefined => {
  return subscriptionPlans[productId];
}; 