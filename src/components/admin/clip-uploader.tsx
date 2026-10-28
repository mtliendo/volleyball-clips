"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Job = {
  id: string;
  name: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  message?: string;
};

const CONCURRENCY = 3;

async function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (value: number) => void,
) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

export function ClipUploader({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);

  function updateJob(id: string, patch: Partial<Job>) {
    setJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  }

  async function uploadFile(file: File, jobId: string) {
    updateJob(jobId, { status: "uploading", progress: 0 });
    const presign = await fetch("/api/admin/clips/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }),
    });
    const data = await presign.json();
    if (!presign.ok) {
      throw new Error(data.error ?? "Could not start upload");
    }

    await putWithProgress(data.uploadUrl, file, data.contentType, (progress) => {
      updateJob(jobId, { progress });
    });

    const complete = await fetch(`/api/admin/clips/${data.clip.id}/complete`, {
      method: "POST",
    });
    if (!complete.ok) {
      throw new Error("Upload finished but the clip was not marked processing");
    }

    updateJob(jobId, { status: "done", progress: 100 });
  }

  async function onFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    const created = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      name: file.name,
      progress: 0,
      status: "queued" as const,
    }));
    setJobs((current) => [...created, ...current]);

    let index = 0;
    async function worker() {
      while (index < files.length) {
        const current = index;
        index += 1;
        const file = files[current];
        const job = created[current];
        try {
          await uploadFile(file, job.id);
        } catch (error) {
          updateJob(job.id, {
            status: "error",
            message: error instanceof Error ? error.message : "Upload failed",
          });
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()),
    );
    router.refresh();
  }

  return (
    <section className="well p-4">
      <h2 className="display text-2xl">Upload clips</h2>
      <p className="mt-1 text-sm text-muted">
        Pick videos from the camera roll. Uploads go straight to S3 in parallel.
      </p>
      <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-card border border-dashed border-rule-2 bg-paper-3 px-4 text-center">
        <span className="text-sm">Tap to choose videos</span>
        <span className="mt-1 text-xs text-muted">Up to 1 GB each · MP4 / MOV / WebM</span>
        <input
          type="file"
          accept="video/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            void onFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {jobs.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="truncate pr-3">{job.name}</span>
                <span className="text-xs text-muted">
                  {job.status === "done"
                    ? "Uploaded"
                    : job.status === "error"
                      ? job.message
                      : `${job.progress}%`}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-paper-3">
                <div
                  className={`h-full ${job.status === "error" ? "bg-error" : "bg-accent"}`}
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
