export type Category = {
  id: string;
  name: string;
  sortOrder: number;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  vegFlag: boolean;
  available: boolean;
  description: string;
};
