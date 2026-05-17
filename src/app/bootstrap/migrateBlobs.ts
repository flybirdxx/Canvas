import { useCanvasStore } from '@/store/useCanvasStore';
import { blobKey, storeBlob } from '@/services/fileStorage';

export function runBlobMigration(): void {
  const queue = window.__canvasBlobMigration;
  if (!queue || queue.length === 0) return;
  delete window.__canvasBlobMigration;

  const migrationTasks = queue.map(async ({ id, dataUrl }) => {
    try {
      const key = blobKey(id);
      await storeBlob(key, dataUrl);
      const el = useCanvasStore.getState().elements.find(e => e.id === id);
      if (el && el.type === 'file') {
        useCanvasStore.getState().updateElement(id, {
          persistence: 'blob',
          blobKey: key,
          src: '',
        } as Partial<typeof el>);
      }
      return { id, ok: true };
    } catch (err) {
      console.warn(`[migration] blob store failed for ${id}, keeping data`, err);
      return { id, ok: false, error: err };
    }
  });

  Promise.allSettled(migrationTasks).then((results) => {
    const failed = results.filter(r => r.status === 'fulfilled' && !r.value?.ok);
    if (failed.length > 0) {
      console.warn(`[migration] ${failed.length}/${queue.length} blob migrations failed, kept as data URLs`);
    }
  });
}
