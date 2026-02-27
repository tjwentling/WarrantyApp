export type Category =
  | 'Electronics'
  | 'Appliances'
  | 'Vehicles'
  | 'Furniture'
  | 'Toys'
  | 'Food & Beverage'
  | 'Medical Devices'
  | 'Clothing & Accessories'
  | 'Tools & Equipment'
  | 'Other';

export type RecallSource = 'CPSC' | 'NHTSA' | 'FDA' | 'USDA' | 'EPA';

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  push_token: string | null;
  created_at: string;
}

export interface Item {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  category: Category | null;
  purchase_date: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  warranties?: Warranty[];
  item_recalls?: ItemRecall[];
}

export interface Warranty {
  id: string;
  item_id: string;
  start_date: string | null;
  end_date: string | null;
  coverage_notes: string | null;
  document_url: string | null;
  created_at: string;
}

export interface Recall {
  id: string;
  source: RecallSource;
  external_id: string;
  title: string;
  description: string | null;
  hazard: string | null;
  remedy: string | null;
  affected_products: object | null;
  recall_date: string | null;
  url: string | null;
  created_at: string;
}

export interface ItemRecall {
  id: string;
  item_id: string;
  recall_id: string;
  notified_at: string;
  acknowledged_at: string | null;
  recalls?: Recall;
}

export interface Notification {
  id: string;
  user_id: string;
  item_id: string | null;
  recall_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
  items?: Pick<Item, 'id' | 'name' | 'brand'>;
  recalls?: Pick<Recall, 'id' | 'title' | 'source'>;
}

export interface OwnershipTransfer {
  id: string;
  item_id: string;
  from_user_id: string;
  to_user_id: string;
  transferred_at: string;
  notes: string | null;
}
