import dayjs from "dayjs";
import { Bag, User } from "../../api";

export function useBagTooOld(
  authUser: User | null,
  isChainAdmin: boolean,
  bag: Bag,
) {
  const bagUpdatedAt = dayjs(bag.updated_at);
  const isBagTooOld = bagUpdatedAt.isBefore(dayjs().add(-7, "days"));
  const isBagTooOldMe = bag.user_uid === authUser?.uid && isBagTooOld;
  const isBagTooOldHost = isChainAdmin && isBagTooOld;

  return { bagUpdatedAt, isBagTooOld, isBagTooOldMe, isBagTooOldHost };
}
