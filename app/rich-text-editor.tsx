"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { JSONContent } from "@tiptap/core";
import { useEffect } from "react";

export type RichText = { type: "doc"; content?: JSONContent[] };
export const emptyDocument: RichText = { type: "doc", content: [{ type: "paragraph" }] };

export function RichTextEditor({ value, onChange, placeholder }: { value: RichText; onChange: (value: RichText) => void; placeholder: string }) {
  const editor = useEditor({ extensions: [StarterKit], content: value || emptyDocument, immediatelyRender: false, editorProps: { attributes: { class: "rich-text-content", "data-placeholder": placeholder } }, onUpdate: ({ editor }) => onChange(editor.getJSON() as RichText) });
  useEffect(() => { if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.commands.setContent(value || emptyDocument, { emitUpdate: false }); }, [editor, value]);
  if (!editor) return <div className="rich-text-loading" />;
  const active = (name: string) => editor.isActive(name) ? "active" : "";
  return <div className="rich-text-editor"><div className="rich-text-toolbar" aria-label="Formatting controls">
    <button type="button" className={active("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
    <button type="button" className={active("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
    <button type="button" className={active("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
    <button type="button" className={active("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
    <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>Clear</button>
  </div><EditorContent editor={editor} /></div>;
}
