"use client";

import { FormEvent, useEffect, useState } from "react";
import { emptyDocument, RichText, RichTextEditor } from "./rich-text-editor";

type Card = {
  id?: string;
  name: string;
  image_url: string;
  upright: string;
  reversed: string;
  upright_description: RichText;
  reversed_description: RichText;
  category: string;
  description?: RichText;
  theme: string;
};
const blank: Card = {
  name: "",
  image_url: "",
  upright: "",
  reversed: "",
  upright_description: emptyDocument,
  reversed_description: emptyDocument,
  category: "",
  description: emptyDocument,
  theme: "",
};

export function CardManager() {
  const [cards, setCards] = useState<Card[]>([]);
  const [card, setCard] = useState<Card>(blank);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [savedCard, setSavedCard] = useState(() => JSON.stringify(blank));
  const isDirty = JSON.stringify(card) !== savedCard;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/cards");
      if (!res.ok) throw new Error("Could not load cards");
      setCards(await res.json());
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not load cards");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const warnBeforeExit = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeExit);
    return () => window.removeEventListener("beforeunload", warnBeforeExit);
  }, [isDirty]);
  const visible = cards.filter((c) =>
    `${c.name} ${c.category} ${c.theme}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  function select(next: Card) {
    if (next.id !== selectedId && isDirty && !window.confirm("You have unsaved changes. Leave this card without saving?")) return;
    const nextCard = { ...next, description: next.description ?? emptyDocument };
    setSelectedId(next.id);
    setCard(nextCard);
    setSavedCard(JSON.stringify(nextCard));
    setNotice("");
  }
  function update<K extends keyof Card>(field: K, value: Card[K]) {
    setCard((current) => ({ ...current, [field]: value }));
  }
  function newCard() {
    if (isDirty && !window.confirm("You have unsaved changes. Start a new card without saving?")) return;
    setSelectedId(undefined);
    setCard(blank);
    setSavedCard(JSON.stringify(blank));
    setNotice("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch(
        selectedId ? `/api/cards/${selectedId}` : "/api/cards",
        {
          method: selectedId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(card),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save card");
      setCards((current) =>
        selectedId
          ? current.map((c) => (c.id === selectedId ? data : c))
          : [...current, data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      const saved = { ...data, description: data.description ?? emptyDocument };
      setSelectedId(data.id);
      setCard(saved);
      setSavedCard(JSON.stringify(saved));
      setNotice(selectedId ? "Changes saved" : "Card created");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not save card");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="spark">✦</span>
          <div>
            <b>Arcana</b>
            <small>Card catalog</small>
          </div>
        </div>
        <button className="new-button" onClick={newCard}>
          <span>＋</span> New card
        </button>
        <label className="search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards"
          />
        </label>
        <div className="list-label">
          <span>CARDS</span>
          <em>{cards.length}</em>
        </div>
        <div className="card-list">
          {loading && <p className="list-message">Loading catalog…</p>}
          {!loading && visible.length === 0 && (
            <p className="list-message">No matching cards</p>
          )}
          <div style={{ overflow: "visible" }}>
            {visible.map((item) => (
              <button
                key={item.id}
                onClick={() => select(item)}
                className={`card-row ${selectedId === item.id ? "selected" : ""}`}
              >
                <div className="thumb">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" />
                  ) : (
                    <span>✦</span>
                  )}
                </div>
                <div>
                  <strong>{item.name || "Untitled card"}</strong>
                  <small>{item.category || "Uncategorized"}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>
      <section className="editor">
        <header>
          <div>
            <p className="eyebrow">
              {selectedId ? "EDITING CARD" : "NEW CARD"}
            </p>
            <h1>{card.name || "Untitled card"}</h1>
          </div>
          <div className="status">
            {notice && <span>{notice}</span>}
            <button className="save" form="card-form" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </header>
        <form id="card-form" onSubmit={save}>
          <div className="card-overview">
            <div className="card-basics">
              <label className="field name">
              <span>
                Name <i>required</i>
              </span>
              <input
                required
                value={card.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. The Moon"
              />
              </label>
              <label className="field">
              <span>Theme</span>
              <input
                value={card.theme ?? ''}
                onChange={(e) => update("theme", e.target.value)}
                placeholder="Intuition"
              />
              </label>
            </div>
            <div className="image-preview">
              {card.image_url ? (
                <img src={card.image_url} alt={card.name || "Card"} />
              ) : (
                <span>✦ No image available</span>
              )}
            </div>
          </div>
          <div className="divider">
            <span>INTERPRETATION</span>
          </div>
          <div className="form-grid meanings">
            <label className="field">
              <span>Upright keywords</span>
              <input
                value={card.upright ?? ''}
                onChange={(e) => update("upright", e.target.value)}
                placeholder="Hope, guidance, renewal"
              />
            </label>
            <label className="field">
              <span>Reversed keywords</span>
              <input
                value={card.reversed ?? ''}
                onChange={(e) => update("reversed", e.target.value)}
                placeholder="Doubt, disconnection"
              />
            </label>
            <label className="field long-description">
              <span>Upright description</span>
              <RichTextEditor
                value={card.upright_description}
                onChange={(value) => update("upright_description", value)}
                placeholder="Write the upright interpretation…"
              />
            </label>
            <label className="field long-description">
              <span>Reversed description</span>
              <RichTextEditor
                value={card.reversed_description}
                onChange={(value) => update("reversed_description", value)}
                placeholder="Write the reversed interpretation…"
              />
            </label>
            <label className="field wide">
              <span>General description</span>
              <RichTextEditor
                value={card.description ?? emptyDocument}
                onChange={(value) => update("description", value)}
                placeholder="Add notes about this card…"
              />
            </label>
          </div>
        </form>
      </section>
    </main>
  );
}
