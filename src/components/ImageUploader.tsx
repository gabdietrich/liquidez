"use client";

import { useState, useCallback } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import type { InvestimentoInsert } from "@/types/database";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

interface ImageUploaderProps {
  onExtract: (dados: InvestimentoInsert[]) => void;
  onError?: (message: string | null) => void;
  disabled?: boolean;
}

export function ImageUploader({
  onExtract,
  onError,
  disabled = false,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const processImages = useCallback(
    async (files: File[]) => {
      const validFiles = files.filter((f) => ACCEPTED_TYPES.includes(f.type));
      if (validFiles.length === 0) {
        onError?.("Formato inválido. Use PNG ou JPG.");
        return;
      }

      setLoading(true);
      onError?.(null);

      try {
        const images = await Promise.all(
          validFiles.map(async (file) => ({
            base64: await fileToBase64(file),
            mimeType: file.type,
          }))
        );

        const res = await fetch("/api/extract-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Erro ${res.status}`);
        }

        const { dados } = await res.json();
        if (Array.isArray(dados)) {
          onExtract(dados);
        } else {
          onError?.("Nenhum investimento encontrado nas imagens.");
        }
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "Erro ao processar imagens.");
      } finally {
        setLoading(false);
      }
    },
    [onExtract, onError]
  );

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64 ?? "");
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !loading) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || loading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processImages(files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processImages(files);
    e.target.value = "";
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`
        relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors
        ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
        ${disabled || loading ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        multiple
        onChange={handleFileInput}
        className="absolute inset-0 cursor-pointer opacity-0"
        disabled={disabled || loading}
      />
      {loading ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            Extraindo investimentos das imagens...
          </p>
        </>
      ) : (
        <>
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">
            Arraste imagens ou clique para selecionar (várias permitidas)
          </p>
          <p className="text-xs text-muted-foreground">
            PNG ou JPG
          </p>
        </>
      )}
    </div>
  );
}
