export type PropertyCoverSource = {
  media?: Array<{
    assetId: string;
    isCover?: boolean;
    asset?: { mimeType: string };
  }>;
  images?: Array<{ url: string }>;
};

export function propertyCoverUrl(property: PropertyCoverSource) {
  const media = property.media?.find(
    (item) =>
      item.isCover !== false &&
      (!item.asset || item.asset.mimeType.startsWith("image/")),
  );
  return media
    ? `/api/files/${media.assetId}`
    : (property.images?.[0]?.url ?? "/property-1.png");
}

export function isPrivatePropertyMedia(url: string) {
  return url.startsWith("/api/files/");
}
