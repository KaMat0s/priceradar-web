// PriceRadar AI — Catálogo de 24 categorias monitoradas
// Portado de app/categories.py (hardware + periféricos)

export interface Category {
  id: string;
  label: string;
  group: "HARDWARE" | "PERIPHERAL";
  icon: string;
  examples: string[];
}

export const CATEGORIES: Category[] = [
  // ───── HARDWARE ─────
  { id: "gpu", label: "Placa de Vídeo", group: "HARDWARE", icon: "▣", examples: ["RTX 4070 Super", "RTX 4080", "RX 7800 XT", "RTX 5070"] },
  { id: "cpu", label: "Processador", group: "HARDWARE", icon: "◈", examples: ["Ryzen 7 7800X3D", "Intel i7 14700K", "Ryzen 9 9950X"] },
  { id: "ram", label: "Memória RAM", group: "HARDWARE", icon: "▦", examples: ["DDR5 32GB 6000MHz", "DDR4 16GB 3200", "Corsair Vengeance"] },
  { id: "mobo", label: "Placa-Mãe", group: "HARDWARE", icon: "◆", examples: ["B650 AM5", "Z790 LGA1700", "X670E", "B760"] },
  { id: "ssd", label: "SSD", group: "HARDWARE", icon: "▤", examples: ["SSD NVMe 1TB", "SSD 2TB Gen4", "Samsung 980 Pro"] },
  { id: "hdd", label: "HD / HDD", group: "HARDWARE", icon: "◐", examples: ["HD 2TB Seagate", "WD Blue 4TB", "Toshiba 1TB"] },
  { id: "psu", label: "Fonte (PSU)", group: "HARDWARE", icon: "◉", examples: ["Corsair RM850x", "EVGA 750W", "Fonte 1000W 80 Plus Gold"] },
  { id: "case", label: "Gabinete", group: "HARDWARE", icon: "▢", examples: ["Lian Li O11", "NZXT H7", "Corsair 4000D"] },
  { id: "cooler", label: "Cooler / Water Cooler", group: "HARDWARE", icon: "❅", examples: ["Noctua NH-D15", "Water Cooler 360", "Arctic Liquid Freezer"] },
  { id: "fan", label: "Fan / Ventoinha", group: "HARDWARE", icon: "✦", examples: ["Noctua 120mm", "Corsair LL120 RGB"] },
  { id: "capture", label: "Placa de Captura", group: "HARDWARE", icon: "◇", examples: ["Elgato HD60 X", "Avermedia Live Gamer"] },
  { id: "sound", label: "Placa de Som", group: "HARDWARE", icon: "◊", examples: ["Creative Sound Blaster", "Asus Xonar"] },
  // ───── PERIFÉRICOS ─────
  { id: "keyboard", label: "Teclado", group: "PERIPHERAL", icon: "▰", examples: ["Keychron K2", "Logitech G915", "Razer Huntsman", "Redragon Kumara"] },
  { id: "mouse", label: "Mouse", group: "PERIPHERAL", icon: "◔", examples: ["Logitech G Pro X Superlight", "Razer Viper", "Pulsar X2"] },
  { id: "headset", label: "Headset / Fone", group: "PERIPHERAL", icon: "◖", examples: ["HyperX Cloud III", "SteelSeries Arctis", "Logitech G Pro X"] },
  { id: "monitor", label: "Monitor", group: "PERIPHERAL", icon: "◫", examples: ["LG Ultragear 27", "AOC 27 165Hz", "Samsung Odyssey G7"] },
  { id: "webcam", label: "Webcam", group: "PERIPHERAL", icon: "◉", examples: ["Logitech C920", "Razer Kiyo Pro", "Elgato Facecam"] },
  { id: "mic", label: "Microfone", group: "PERIPHERAL", icon: "◍", examples: ["HyperX QuadCast", "Blue Yeti", "Shure MV7"] },
  { id: "speaker", label: "Caixas de Som", group: "PERIPHERAL", icon: "▷", examples: ["Edifier R1280T", "JBL Quantum", "Logitech Z625"] },
  { id: "mousepad", label: "Mousepad", group: "PERIPHERAL", icon: "▭", examples: ["Logitech G840", "Razer Goliathus", "HyperX Fury"] },
  { id: "chair", label: "Cadeira Gamer", group: "PERIPHERAL", icon: "▥", examples: ["DXRacer", "Secretlab Titan", "ThunderX3"] },
  { id: "controller", label: "Controle / Joystick", group: "PERIPHERAL", icon: "◐", examples: ["Xbox Series Controller", "DualSense", "8BitDo Pro 2"] },
  { id: "wheel", label: "Volante Gamer", group: "PERIPHERAL", icon: "◎", examples: ["Logitech G29", "Thrustmaster T300", "Fanatec CSL DD"] },
  { id: "streamdeck", label: "Stream Deck / Mixer", group: "PERIPHERAL", icon: "▩", examples: ["Elgato Stream Deck", "GoXLR Mini"] },
];

export const byGroup = (g: Category["group"]) => CATEGORIES.filter((c) => c.group === g);
