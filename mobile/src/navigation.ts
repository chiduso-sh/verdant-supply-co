/** Route names and their parameters, in one place so screens stay typed. */
export type RootStackParamList = {
  Catalogue: undefined;
  Product: { slug: string; name: string };
  Cart: undefined;
  Checkout: undefined;
  Orders: undefined;
  /** `isNew` shows the confirmation banner, as `?new=1` does on the website. */
  OrderDetail: { id: string; isNew?: boolean };
  SignIn: undefined;
};
