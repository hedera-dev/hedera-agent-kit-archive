import { ExecutorAccountDetails, HederaNetworkType } from "../types";
import { getPublicKeyByAccountId } from "./api-utils";

/**
 * Ensures executor account details are correctly prepared when using non-custodial mode.
 * If needed, fetches and sets an executor public key.
 */
export const prepareExecutorAccountDetails = async (
  isCustodial: boolean,
  executorAccountDetails: ExecutorAccountDetails | undefined,
  hederaNetworkType: HederaNetworkType
): Promise<ExecutorAccountDetails | undefined> => {
  if (isCustodial) {
    return executorAccountDetails;
  }

  if (!executorAccountDetails) {
    throw new Error("Executor account details are required for non-custodial mode.");
  }

  if (!executorAccountDetails.executorAccountId) {
    throw new Error("Executor account ID is required for non-custodial mode.");
  }

  if (!executorAccountDetails.executorPublicKey) {
    executorAccountDetails.executorPublicKey = await getPublicKeyByAccountId(
      hederaNetworkType,
      executorAccountDetails.executorAccountId
    );
  }

  return executorAccountDetails;
};

