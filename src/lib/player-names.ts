import { trackedAccounts, type AccountIdentity } from "../config/players";
import type { Friend } from "./model";

export function profileAccounts(
  friend: Pick<Friend, "name" | "tag" | "accounts">,
): AccountIdentity[] {
  const configured = trackedAccounts.find(
    (profile) =>
      profile.name.toLowerCase() === friend.name.toLowerCase() &&
      profile.tag.toLowerCase() === friend.tag.toLowerCase(),
  );
  const accounts = [
    friend,
    ...(friend.accounts ?? []),
    ...(configured?.aliases ?? []),
  ];
  return [
    ...new Map(
      accounts.map(({ name, tag }) => [
        `${name}#${tag}`.toLowerCase(),
        { name, tag },
      ]),
    ).values(),
  ];
}

export function playerLabel(
  friend: Pick<Friend, "name" | "tag" | "accounts">,
  showTags = false,
): string {
  return profileAccounts(friend)
    .map((account) =>
      showTags ? `${account.name}#${account.tag}` : account.name,
    )
    .join(" / ");
}
