import { VariableMetadato } from '@core/models';

export interface ColumnWithUniqueId extends VariableMetadato {
  _uniqueId: string;
}
