import { Model, ModelStatic } from "sequelize";
import config from "../config/config";

export async function findOneWithScope<T extends Model>(
  model: ModelStatic<T>,
  scopeMethod: string,
  whereClause: object,
  customAttributes?: (string | [unknown, string])[]
): Promise<T | null> {
  return await model
    .scope({
      method: [
        scopeMethod,
        whereClause,
        config.encryption.dbEncryptionKey,
        customAttributes,
      ],
    })
    .findOne();
}
