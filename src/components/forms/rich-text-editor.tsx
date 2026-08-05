"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { richTextLength } from "@/domain/rich-text";
import { cn } from "@/lib/utils";

/**
 * Small rich-text editor for the long narrative answers.
 *
 * Deliberately limited to emphasis and lists: reviewers read dozens of these
 * side by side, and the PDF has to reproduce them faithfully, so arbitrary
 * formatting would cost more than it gives. The value is HTML, sanitised again
 * on the server before it is stored.
 */

interface ToolbarButtonProps {
  editor: Editor;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({
  label,
  icon: Icon,
  isActive,
  disabled,
  onClick,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8", isActive && "bg-accent text-accent-foreground")}
      aria-label={label}
      aria-pressed={isActive}
      disabled={disabled}
      // `onMouseDown` prevention keeps focus in the document, so the command
      // applies to the current selection rather than an empty one.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  );
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  id?: string;
  placeholder?: string;
  maxLength?: number;
  minLength?: number;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  id,
  placeholder,
  maxLength,
  minLength,
  disabled = false,
  invalid = false,
  describedBy,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    // Tiptap must not render during SSR; the server has no DOM.
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        link: false,
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        id: id ?? "",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": placeholder ?? "Rich text editor",
        "aria-invalid": invalid ? "true" : "false",
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        class:
          "rich-text-content min-h-36 w-full px-3 py-2 focus:outline-none [&_p.is-editor-empty:first-child::before]:text-muted-foreground",
      },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      // Tiptap represents an empty document as "<p></p>"; report that as "".
      onChange(instance.isEmpty ? "" : html);
    },
    onBlur: () => onBlur?.(),
  });

  // Keep the editor in step when the form resets or loads a saved draft.
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const length = richTextLength(value);
  const overLimit = maxLength !== undefined && length > maxLength;
  const underMinimum = minLength !== undefined && length > 0 && length < minLength;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        data-invalid={invalid || undefined}
        className={cn(
          "overflow-hidden rounded-md border bg-transparent shadow-xs transition-[color,box-shadow]",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          invalid && "border-destructive focus-within:ring-destructive/20",
          disabled && "opacity-60",
        )}
      >
        {editor && (
          <div
            role="toolbar"
            aria-label="Text formatting"
            aria-controls={id}
            className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1"
          >
            <ToolbarButton
              editor={editor}
              label="Bold"
              icon={Bold}
              isActive={editor.isActive("bold")}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              editor={editor}
              label="Italic"
              icon={Italic}
              isActive={editor.isActive("italic")}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              editor={editor}
              label="Strikethrough"
              icon={Strikethrough}
              isActive={editor.isActive("strike")}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            />

            <Separator orientation="vertical" className="mx-1 h-5" />

            <ToolbarButton
              editor={editor}
              label="Bulleted list"
              icon={List}
              isActive={editor.isActive("bulletList")}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              editor={editor}
              label="Numbered list"
              icon={ListOrdered}
              isActive={editor.isActive("orderedList")}
              disabled={disabled}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />

            <Separator orientation="vertical" className="mx-1 h-5" />

            <ToolbarButton
              editor={editor}
              label="Undo"
              icon={Undo2}
              disabled={disabled || !editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            />
            <ToolbarButton
              editor={editor}
              label="Redo"
              icon={Redo2}
              disabled={disabled || !editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            />
          </div>
        )}

        <EditorContent editor={editor} />

        {!editor && (
          <div className="min-h-36 px-3 py-2 text-sm text-muted-foreground">Loading editor…</div>
        )}
      </div>

      {(maxLength !== undefined || minLength !== undefined) && (
        <p
          className={cn(
            "text-right text-xs tabular-nums",
            overLimit || underMinimum ? "text-destructive" : "text-muted-foreground",
          )}
          // Announced only when it becomes a problem, not on every keystroke.
          aria-live={overLimit || underMinimum ? "polite" : "off"}
        >
          {underMinimum
            ? `${length} / ${minLength} characters minimum`
            : maxLength !== undefined
              ? `${length} / ${maxLength} characters`
              : `${length} characters`}
        </p>
      )}
    </div>
  );
}
