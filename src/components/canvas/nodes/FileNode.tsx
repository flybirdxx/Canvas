import React, { useState, useEffect, useRef } from 'react';
import { Group, Rect, Image as KonvaImage } from 'react-konva';
import { Html } from 'react-konva-utils';
import useImage from 'use-image';
import {
  File as FileIcon, FileText, FileArchive, FileCode, FileAudio, FileVideo,
  FileImage, Upload,
} from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import {
  formatBytes, formatDuration, previewKindForMime, buildFileElement,
} from '@/services/fileIngest';
import type { FilePreviewKind } from '@/services/fileIngest';
import { readBlobAsBlob } from '@/services/fileStorage';
import { POLAROID_STYLE, PAPER_EDGE, BG_1 } from './shared';

function pickAttachmentIcon(name: string, mime: string) {
  const mt = mime.toLowerCase();
  if (mt.startsWith('image/')) return FileImage;
  if (mt.startsWith('video/')) return FileVideo;
  if (mt.startsWith('audio/')) return FileAudio;

  const ext = name.toLowerCase().split('.').pop() || '';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) return FileArchive;
  if ([
    'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
    'css', 'scss', 'html', 'json', 'yaml', 'yml', 'toml', 'xml', 'sh', 'bat', 'ps1',
  ].includes(ext)) return FileCode;
  if (['txt', 'md', 'markdown', 'rtf', 'log', 'csv', 'doc', 'docx'].includes(ext)) return FileText;

  return FileIcon;
}

function AttachmentCardBody({
  name,
  mime,
  sizeLabel,
  pageCount,
  durationLabel,
}: {
  name: string;
  mime: string;
  sizeLabel: string;
  pageCount?: number;
  durationLabel?: string;
}) {
  const Icon = pickAttachmentIcon(name, mime);
  const metaParts: string[] = [sizeLabel];
  if (pageCount && pageCount > 0) metaParts.push(`${pageCount} 页`);
  else if (mime) metaParts.push(mime.split('/').pop() || '');
  if (durationLabel) metaParts.push(durationLabel);
  return (
    <div
      className="flex flex-col items-center justify-center gap-2.5"
      style={{
        width: '100%',
        height: '100%',
        padding: 16,
        textAlign: 'center',
      }}
    >
      <Icon
        className="w-9 h-9"
        strokeWidth={1.3}
        style={{ color: 'var(--ink-2)' }}
      />
      <div
        style={{
          fontSize: 12,
          color: 'var(--ink-0)',
          fontWeight: 500,
          lineHeight: 1.3,
          wordBreak: 'break-all',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          maxWidth: '100%',
        }}
      >
        {name}
      </div>
      <div
        className="meta"
        style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.03em' }}
      >
        {metaParts.filter(Boolean).join(' · ')}
      </div>
    </div>
  );
}

function FileNodeOverlayChips({
  el, width, height, kind, absoluteInCard,
}: {
  el: any;
  width: number;
  height: number;
  kind: FilePreviewKind;
  absoluteInCard?: boolean;
}) {
  const name = String(el.name || 'untitled');
  const mime = String(el.mimeType || '');
  const sizeLabel = formatBytes(Number(el.sizeBytes) || 0);
  const tooltip = `${name}\n${sizeLabel}${mime ? ` · ${mime}` : ''}`;

  const updateElement = useCanvasStore(s => s.updateElement);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleReplaceClick = () => {
    replaceInputRef.current?.click();
  };
  const handleReplaceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const rebuilt = await buildFileElement(file, { x: cx, y: cy });
      updateElement(el.id, {
        name: rebuilt.name,
        mimeType: rebuilt.mimeType,
        sizeBytes: rebuilt.sizeBytes,
        src: rebuilt.src,
        x: rebuilt.x,
        y: rebuilt.y,
        width: rebuilt.width,
        height: rebuilt.height,
        thumbnailDataUrl: rebuilt.thumbnailDataUrl,
        durationMs: rebuilt.durationMs,
        pageCount: rebuilt.pageCount,
      } as any);
    } catch (err) {
      console.warn('[file] replace failed', file.name, err);
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();
  const interactiveStyle = { pointerEvents: 'auto' as const };

  const chipBar = (
    <div
      className="absolute flex items-center gap-1.5"
      style={{ top: 10, right: 10, ...interactiveStyle }}
      onPointerDown={stopPropagation}
    >
      {kind !== 'image' && el.src && (
        <a
          href={el.src}
          download={name}
          target="_blank"
          rel="noopener noreferrer"
          className="chip-paper flex items-center gap-1 no-underline"
          style={{
            padding: '4px 9px',
            borderRadius: 'var(--r-full, 999px)',
            fontSize: 10.5,
            color: 'var(--ink-0)',
            lineHeight: 1,
            cursor: 'pointer',
          }}
          title="在新标签打开 / 下载"
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-ink-2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
        >
          <FileText className="w-3 h-3" strokeWidth={1.8} />
          <span className="serif-it" style={{ letterSpacing: '0.02em' }}>打开</span>
        </a>
      )}
      <button
        type="button"
        onClick={handleReplaceClick}
        className="chip-paper flex items-center gap-1 transition-all"
        style={{
          padding: '4px 9px',
          borderRadius: 'var(--r-full, 999px)',
          fontSize: 10.5,
          color: 'var(--ink-0)',
          cursor: 'pointer',
          lineHeight: 1,
        }}
        title={`替换当前附件\n${tooltip}`}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-ink-2)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
      >
        <Upload className="w-3 h-3" strokeWidth={1.8} />
        <span className="serif-it" style={{ letterSpacing: '0.02em' }}>替换</span>
      </button>
      <input
        ref={replaceInputRef}
        type="file"
        accept="*/*"
        style={{ display: 'none' }}
        onChange={handleReplaceChange}
      />
    </div>
  );

  if (absoluteInCard) return chipBar;
  return (
    <div className="relative" style={{ width, height, pointerEvents: 'none' }}>
      {chipBar}
    </div>
  );
}

function FileNodeInfoBand({ el }: { el: any }) {
  const name = String(el.name || 'untitled');
  const sizeLabel = formatBytes(Number(el.sizeBytes) || 0);
  const durationMs = typeof el.durationMs === 'number' ? el.durationMs : undefined;
  const durationLabel = durationMs ? formatDuration(durationMs) : '';
  return (
    <div
      className="absolute flex items-center chip-paper"
      style={{
        left: 10,
        bottom: 10,
        padding: '3px 8px',
        borderRadius: 'var(--r-full, 999px)',
        fontSize: 10,
        lineHeight: 1.2,
        color: 'var(--ink-1)',
        letterSpacing: '0.02em',
        maxWidth: '70%',
        pointerEvents: 'none',
        opacity: 0.92,
      }}
      title={`${name} · ${sizeLabel}${durationLabel ? ` · ${durationLabel}` : ''}`}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
      >
        {name}
        <span style={{ color: 'var(--ink-3)' }}>
          {' · '}{sizeLabel}
          {durationLabel && <> · {durationLabel}</>}
        </span>
      </span>
    </div>
  );
}

function FileVideoPlayBadge() {
  const SIZE = 44;
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        top: '50%',
        left: '50%',
        width: SIZE,
        height: SIZE,
        marginTop: -SIZE / 2,
        marginLeft: -SIZE / 2,
        borderRadius: '50%',
        background: 'rgba(25, 20, 15, 0.55)',
        backdropFilter: 'blur(1px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 0,
          height: 0,
          marginLeft: 3,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderLeft: '13px solid rgba(255, 248, 235, 0.95)',
        }}
      />
    </div>
  );
}

function FileImageKonvaBody({
  el, src, width, height,
}: {
  el: any;
  src?: string;
  width: number;
  height: number;
}) {
  const imageSrc = src ?? el.src ?? '';
  const [img] = useImage(imageSrc);
  const paperRect = (
    <Rect
      x={-1} y={-1}
      width={width + 2} height={height + 2}
      cornerRadius={13}
      stroke={PAPER_EDGE}
      strokeWidth={1}
      listening={false}
    />
  );
  const bgRect = (
    <Rect
      width={width} height={height}
      cornerRadius={12}
      fill={BG_1}
      shadowColor="rgba(40,30,20,0.12)"
      shadowBlur={20}
      shadowOffsetY={6}
      shadowOpacity={1}
      listening={false}
    />
  );
  if (!img) {
    return <>{paperRect}{bgRect}</>;
  }
  const nw = img.naturalWidth || img.width || 1;
  const nh = img.naturalHeight || img.height || 1;
  const imgAspect = nw / nh;
  const frameAspect = width / height;
  let drawW: number; let drawH: number; let drawX: number; let drawY: number;
  if (imgAspect > frameAspect) {
    drawW = width;
    drawH = width / imgAspect;
    drawX = 0;
    drawY = (height - drawH) / 2;
  } else {
    drawH = height;
    drawW = height * imgAspect;
    drawX = (width - drawW) / 2;
    drawY = 0;
  }
  return (
    <>
      {paperRect}
      {bgRect}
      <KonvaImage
        image={img}
        x={drawX}
        y={drawY}
        width={drawW}
        height={drawH}
        cornerRadius={12}
        listening={false}
      />
    </>
  );
}

function FileNodeBody({
  el,
  width,
  height,
}: {
  el: any;
  width: number;
  height: number;
}) {
  const name = String(el.name || 'untitled');
  const mime = String(el.mimeType || '');
  const kind = previewKindForMime(mime);
  const sizeLabel = formatBytes(Number(el.sizeBytes) || 0);
  const tooltip = `${name}\n${sizeLabel}${mime ? ` · ${mime}` : ''}`;

  return (
    <div
      className="relative overflow-hidden"
      style={{ ...POLAROID_STYLE, width, height, pointerEvents: 'none' }}
      title={tooltip}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ width: '100%', height: '100%', background: 'var(--bg-2)' }}
      >
        {kind === 'image' && el.src && (
          <img
            src={el.src}
            alt={name}
            draggable={false}
            style={{
              width: '100%', height: '100%', objectFit: 'contain', display: 'block',
            }}
          />
        )}
        {kind !== 'image' && (
          <AttachmentCardBody
            name={name}
            mime={mime}
            sizeLabel={sizeLabel}
            pageCount={typeof el.pageCount === 'number' ? el.pageCount : undefined}
          />
        )}
      </div>

      <FileNodeOverlayChips
        el={el}
        width={width}
        height={height}
        kind={kind}
        absoluteInCard
      />
    </div>
  );
}

export function FileNode({ el }: { el: any }) {
  const { width, height } = el;
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const [blobFailed, setBlobFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (el.persistence === 'blob' && el.blobKey) {
      readBlobAsBlob(el.blobKey).then((blob) => {
        if (cancelled) return;
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setResolvedSrc(objectUrl);
        } else {
          setBlobFailed(true);
        }
      }).catch(() => {
        if (!cancelled) setBlobFailed(true);
      });
    } else {
      setResolvedSrc(el.src || '');
    }

    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [el.id, el.blobKey]);

  const hydratedEl = (el.persistence === 'blob' && resolvedSrc)
    ? { ...el, src: resolvedSrc }
    : el;

  const fileKind = previewKindForMime(String(el.mimeType || ''));
  const hasThumb = blobFailed
    ? false
    : fileKind === 'image'
      ? !!hydratedEl.src
      : !!el.thumbnailDataUrl;

  if (blobFailed) {
    return (
      <Group>
        <Rect
          width={width} height={height}
          fill="#FFFFFF" cornerRadius={12}
          stroke="rgba(40,30,20,0.12)" strokeWidth={1}
        />
        <Html divProps={{ style: { pointerEvents: 'none' } }}>
          <div style={{
            ...POLAROID_STYLE,
            width, height,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-2)', gap: 4,
          }}>
            <Upload style={{ width: 22, height: 22, color: 'var(--ink-3)' }} />
            <span style={{ fontSize: 11 }}>附件已丢失</span>
            <span style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>点此重传</span>
          </div>
        </Html>
      </Group>
    );
  }

  if (hasThumb) {
    const thumbSrc = fileKind === 'image' ? hydratedEl.src : el.thumbnailDataUrl;
    return (
      <Group>
        <Rect width={width} height={height} fill="transparent" />
        <FileImageKonvaBody el={hydratedEl} src={thumbSrc} width={width} height={height} />
        <Html divProps={{ style: { pointerEvents: 'none' } }}>
          <div className="relative" style={{ width, height, pointerEvents: 'none' }}>
            {fileKind === 'video' && <FileVideoPlayBadge />}
            <FileNodeOverlayChips
              el={hydratedEl}
              width={width}
              height={height}
              kind={fileKind}
              absoluteInCard
            />
            <FileNodeInfoBand el={hydratedEl} />
          </div>
        </Html>
      </Group>
    );
  }

  return (
    <Group>
      <Rect width={width} height={height} fill="transparent" />
      <Html divProps={{ style: { pointerEvents: 'none' } }}>
        <FileNodeBody el={hydratedEl} width={width} height={height} />
      </Html>
    </Group>
  );
}