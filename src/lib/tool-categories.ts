import { ArrowLeftRight, Database, FileText, FolderArchive, Image, Music, Sparkles } from "lucide-react";

export const toolCategories = [
  { name: "PDF", href: "/pdf", icon: FileText, description: "Merge, split, compress, and sign.", tone: "rose" },
  { name: "Image", href: "/image", icon: Image, description: "Crop, resize, and clean up images.", tone: "violet" },
  { name: "Media", href: "/media", icon: Music, description: "Trim and convert audio or video.", tone: "sky" },
  { name: "Convert", href: "/convert", icon: ArrowLeftRight, description: "Find the right format for a file.", tone: "lime" },
  { name: "Files", href: "/files", icon: FolderArchive, description: "Zip, rename, and find duplicates.", tone: "amber" },
  { name: "Data", href: "/data", icon: Database, description: "Work with CSV, JSON, colors, and QR codes.", tone: "mint" },
  { name: "AI", href: "/ai", icon: Sparkles, description: "Summarize text or describe images with your Gemini API key.", tone: "violet" },
] as const;