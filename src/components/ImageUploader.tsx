"use client";

import { useState, useCallback } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import type { InvestimentoInsert } from "@/types/database";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];
const ACCEPTED_PDF_TYPES = ["application/pdf", "application/x-pdf"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_PDF_TYPES];

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;

function isPdfFile(file: File): boolean {
  const type = file.type?.toLowerCase();
  if (ACCEPTED_PDF_TYPES.includes(type)) return true;
  if (!type && file.name?.toLowerCase().endsWith(".pdf")) return true;
  return false;
}

function isAcceptedFile(file: File): boolean {
  const type = file.type?.toLowerCase();
  if (ACCEPTED_TYPES.includes(type)) return true;
  if (!type || type === "") {
    const ext = file.name?.toLowerCase().split(".").pop();
    if (ext === "pdf") return true;
    if (["png", "jpg", "jpeg"].includes(ext ?? "")) return true;
  }
  return false;
}

interface ImageUploaderProps {
  onExtract: (dados: InvestimentoInsert[]) => void;
  onError?: (message: string | null) => void;
  onAviso?: (message: string | null) => void;
  preprocessImage?: (file: File) => Promise<File>;
  disabled?: boolean;
}

export function ImageUploader({
  onExtract,
  onError,
  onAviso,
  preprocessImage,
  disabled = false,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const processFiles = useCallback(
    async (files: File[]) => {
      const validFiles = files.filter((f) => isAcceptedFile(f));
      if (validFiles.length === 0) {
        onError?.("Formato inválido. Use PNG, JPG ou PDF.");
        return;
      }

      setLoading(true);
      onError?.(null);
      onAviso?.(null);

      try {
        const pdfFiles = validFiles.filter((f) => isPdfFile(f));
        const imageFiles = validFiles.filter((f) => !isPdfFile(f));

        const body: { pdf?: string; images?: Array<{ base64: string; mimeType: string }> } = {};

        if (pdfFiles.length > 0) {
          const pdfFile = pdfFiles[0];
          if (pdfFile.size > MAX_PDF_SIZE_BYTES) {
            onError?.(`PDF muito grande (${(pdfFile.size / 1024 / 1024).toFixed(1)}MB). Use um arquivo menor ou envie imagens (PNG/JPG) do extrato.`);
            setLoading(false);
            return;
          }
          const pdfBase64 = await fileToBase64(pdfFile);
          body.pdf = pdfBase64;
        }

        if (imageFiles.length > 0) {
          body.images = await Promise.all(
            imageFiles.map(async (file) => {
              const processed = preprocessImage ? await preprocessImage(file) : file;
              const base64 = await fileToBase64(processed);
              return { base64, mimeType: processed.type || "image/jpeg" };
            })
          );
        }

        const res = await fetch("/api/extract-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const bodyText = await res.text();
          const errBody = (() => {
            try {
              return bodyText ? JSON.parse(bodyText) : {};
            } catch {
              return { raw: bodyText };
            }
          })();
          console.error("[Upload] Resposta de erro da API:", res.status, errBody);

          const statusMsg =
            res.status === 504
              ? "Erro 504: O servidor demorou demais."
              : res.status === 413
                ? "Erro 413: Arquivo grande demais."
                : res.status === 502 || res.status === 503
                  ? `Erro ${res.status}: Serviço temporariamente indisponível.`
                  : typeof errBody === "object" && errBody !== null && "error" in errBody
                    ? `Erro ${res.status}: ${String((errBody as { error?: string }).error ?? "Falha na extração.")}`
                    : `Erro ${res.status}: Falha na extração.`;

          throw new Error(statusMsg);
        }

        const { dados, aviso } = await res.json();
        const lista = Array.isArray(dados) ? dados : [];
        onExtract(lista);
        if (lista.length === 0) {
          onError?.(
            "Nenhum investimento identificado. Tente um print com mais contraste ou com os nomes dos ativos visíveis"
          );
        } else {
          onError?.(null);
          if (aviso) onAviso?.(aviso);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao processar arquivos.";
        console.error("[Upload] Erro no upload:", e);
        onError?.(msg);
      } finally {
        setLoading(false);
      }
    },
    [onExtract, onError, onAviso, preprocessImage]
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
    if (files.length > 0) processFiles(files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processFiles(files);
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
        accept="image/png,image/jpeg,image/jpg,application/pdf,.pdf"
        multiple
        onChange={handleFileInput}
        className="absolute inset-0 cursor-pointer opacity-0"
        disabled={disabled || loading}
      />
      {loading ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            Extraindo investimentos...
          </p>
        </>
      ) : (
        <>
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">
            Arraste imagens/PDF ou clique para selecionar (vários permitidos)
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG ou PDF
          </p>
        </>
      )}
    </div>
  );
}
