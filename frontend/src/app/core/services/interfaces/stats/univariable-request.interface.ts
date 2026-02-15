export interface ChartFilter {
  column: string;
  operator:
    | 'eq'
    | 'neq'
    | 'in'
    | 'not_in'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'between'
    | 'contains'
    | 'not_contains';
  value: any;
}

export interface UnivariableRequest {
  dataset_id: string;
  variable_id: string;
  chart_type?: string;
  limit?: number;
  filters?: ChartFilter[];
}
