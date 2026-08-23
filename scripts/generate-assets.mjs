import sharp from "sharp";
const palettes = [
  ["#D7A483", "#7B8794"],
  ["#B8C8B8", "#65786C"],
  ["#E0C49A", "#9A7254"],
  ["#B9C6D4", "#63758B"],
  ["#D8B4AE", "#8D6662"],
  ["#C6B9A6", "#71675A"],
];
for (let i = 0; i < palettes.length; i++) {
  const [bg, accent] = palettes[i];
  const blocks = [
    {
      input: {
        create: { width: 900, height: 540, channels: 3, background: bg },
      },
      left: 0,
      top: 0,
    },
    {
      input: {
        create: { width: 520, height: 270, channels: 3, background: accent },
      },
      left: 190,
      top: 150,
    },
    {
      input: {
        create: { width: 170, height: 210, channels: 3, background: "#F4EEE5" },
      },
      left: 245,
      top: 205,
    },
    {
      input: {
        create: { width: 170, height: 210, channels: 3, background: "#E8DFD4" },
      },
      left: 485,
      top: 205,
    },
  ];
  await sharp({
    create: { width: 900, height: 540, channels: 3, background: bg },
  })
    .composite(blocks.slice(1))
    .png()
    .toFile(`public/property-${i + 1}.png`);
}
await sharp({
  create: { width: 64, height: 64, channels: 3, background: "#C65D35" },
})
  .png()
  .toFile("app/icon.png");
