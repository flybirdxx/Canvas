import { resumePendingImageTasks } from '@/services/taskResume';

export function startTaskResumeLoop(): () => void {
  resumePendingImageTasks();
  const id = window.setInterval(resumePendingImageTasks, 3 * 60 * 1000);
  return () => window.clearInterval(id);
}
