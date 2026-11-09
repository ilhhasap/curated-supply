import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";

const KEY = "held-v1-notes";

type Note = {
  id: string;
  path: string;
  target: string;
  body: string;
  at: string;
};

type Draft = { target: string; x: number; y: number };

function readNotes(): Note[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CommentLayer() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [on, setOn] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setNotes(readNotes());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(notes));
  }, [notes, ready]);

  useEffect(() => {
    document.querySelectorAll("[data-annotate]").forEach((node) => node.classList.remove("is-noted"));
    for (const note of notes) {
      if (note.path !== path) continue;
      const node = document.querySelector(`[data-annotate="${CSS.escape(note.target)}"]`);
      node?.classList.add("is-noted");
    }
  }, [notes, path]);

  useEffect(() => {
    if (!on) {
      document.querySelectorAll(".is-aim").forEach((node) => node.classList.remove("is-aim"));
      return;
    }
    let last: HTMLElement | null = null;
    const over = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-comment-ui]")) return;
      const node = target?.closest("[data-annotate]") as HTMLElement | null;
      if (last && last !== node) last.classList.remove("is-aim");
      if (node) node.classList.add("is-aim");
      last = node;
    };
    const click = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-comment-ui]")) return;
      event.preventDefault();
      event.stopPropagation();
      const node = target?.closest("[data-annotate]") as HTMLElement | null;
      const label =
        node?.dataset.annotate ||
        target?.innerText?.replace(/\s+/g, " ").trim().slice(0, 80) ||
        "This part";
      setDraft({ target: label, x: event.clientX, y: event.clientY });
      setText("");
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("click", click, true);
      last?.classList.remove("is-aim");
    };
  }, [on]);

  function save() {
    const body = text.trim();
    if (!draft || !body) return;
    setNotes((current) => [
      {
        id: crypto.randomUUID(),
        path,
        target: draft.target,
        body: body.slice(0, 500),
        at: new Date().toISOString(),
      },
      ...current,
    ]);
    setDraft(null);
    setText("");
  }

  const here = notes.filter((note) => note.path === path);

  return (
    <div data-comment-ui className="fixed right-3 bottom-3 left-3 z-30 flex flex-col items-end gap-2 md:left-auto md:w-80">
      {draft ? (
        <div className="w-full border border-line bg-paper p-3">
          <p className="font-mono text-xs text-quiet">Mark · {draft.target}</p>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What should change here?"
            className="mt-2 min-h-20"
            maxLength={500}
          />
          <div className="mt-2 flex gap-4">
            <Button onClick={save} disabled={!text.trim()}>
              Save note
            </Button>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}
      {on && here.length ? (
        <div className="max-h-64 w-full overflow-auto border border-line bg-paper p-3">
          {here.map((note) => (
            <Message key={note.id} from="assistant">
              <MessageContent variant="flat">
                <p className="font-mono text-xs text-quiet">{note.target}</p>
                <p>{note.body}</p>
                <Button
                  className="self-start text-xs text-quiet"
                  onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))}
                >
                  Remove
                </Button>
              </MessageContent>
            </Message>
          ))}
        </div>
      ) : null}
      <div className="flex items-baseline gap-4 border border-line bg-paper px-3 py-2">
        <Button
          onClick={() => {
            setOn((value) => !value);
            setDraft(null);
          }}
        >
          {on ? "Done" : "Comment"}
          {notes.length ? <span className="ml-2 text-quiet">{notes.length}</span> : null}
        </Button>
        {on ? <span className="font-mono text-xs text-quiet">Click a part</span> : null}
        {notes.length ? (
          <Button className="text-xs text-quiet" onClick={() => setNotes([])}>
            Clear
          </Button>
        ) : null}
      </div>
      {on ? (
        <p className="max-w-xs text-right font-mono text-xs text-quiet">
          Notes stay in this browser. For the v1 pass only — not part of Held.
        </p>
      ) : null}
    </div>
  );
}
