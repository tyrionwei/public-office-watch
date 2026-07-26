#!/usr/bin/env python3
"""Extract Taiwan People's Party member snapshots without executing page scripts."""

from __future__ import annotations

import argparse
import html
import json
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterator


@dataclass
class Node:
    tag: str
    attrs: dict[str, str]
    parent: "Node | None" = None
    children: list["Node | str"] = field(default_factory=list)

    def classes(self) -> set[str]:
        return set(self.attrs.get("class", "").split())


class TreeParser(HTMLParser):
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("document", {})
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag, {key: value or "" for key, value in attrs}, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in self.VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        self.stack[-1].children.append(data)


def walk(node: Node) -> Iterator[Node]:
    yield node
    for child in node.children:
        if isinstance(child, Node):
            yield from walk(child)


def descendants(node: Node, *, tag: str | None = None, class_name: str | None = None) -> list[Node]:
    return [
        item
        for item in walk(node)
        if item is not node
        and (tag is None or item.tag == tag)
        and (class_name is None or class_name in item.classes())
    ]


def first(node: Node, *, tag: str | None = None, class_name: str | None = None) -> Node | None:
    matches = descendants(node, tag=tag, class_name=class_name)
    return matches[0] if matches else None


def normalized_lines(node: Node | None) -> list[str]:
    if node is None:
        return []

    parts: list[str] = []

    def collect(item: Node | str) -> None:
        if isinstance(item, str):
            parts.append(item)
            return
        if item.tag == "br":
            parts.append("\n")
            return
        for child in item.children:
            collect(child)
        if item.tag in {"div", "p", "li", "h3", "h5"}:
            parts.append("\n")

    collect(node)
    text = html.unescape("".join(parts)).replace("\xa0", " ")
    return [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]


def text_of(node: Node | None) -> str:
    return " ".join(normalized_lines(node)).strip()


def direct_text(node: Node) -> str:
    return re.sub(r"\s+", " ", "".join(child for child in node.children if isinstance(child, str))).strip()


def parse_profile_details(node: Node | None) -> tuple[list[str], list[str]]:
    lines = normalized_lines(node)
    education: list[str] = []
    experience: list[str] = []
    target: list[str] | None = None
    for line in lines:
        if line == "學歷":
            target = education
        elif line == "經歷":
            target = experience
        elif target is not None:
            target.append(line)
    return education, experience


def social_links(node: Node) -> dict[str, str]:
    links: dict[str, str] = {}
    for anchor in descendants(node, tag="a"):
        href = anchor.attrs.get("href", "")
        if "facebook.com" in href:
            links["facebook"] = href
        elif "youtube.com" in href or "youtu.be" in href:
            links["youtube"] = href
        elif "instagram.com" in href:
            links["instagram"] = href
    return links


def parse_party_members(root: Node, source_url: str, source_file: str) -> list[dict[str, object]]:
    frame = first(root, class_name="member_frame")
    if frame is None:
        return []

    section = text_of(first(frame, class_name="member_title"))
    group = ""
    records: list[dict[str, object]] = []
    for node in walk(frame):
        if "member_sub" in node.classes():
            group = text_of(node)
            continue
        if "member_columns" not in node.classes():
            continue

        name_node = next(
            (
                span
                for span in descendants(node, tag="span")
                if "review_toggler" in span.attrs.get("onclick", "")
            ),
            None,
        )
        name = direct_text(name_node) if name_node else ""
        if not name:
            continue

        details = first(node, class_name="modal_txt")
        education, experience = parse_profile_details(details)
        avatar = text_of(first(node, class_name="modal_avator")) or None
        records.append(
            {
                "source_file": source_file,
                "source_url": source_url,
                "source_person_url": source_url,
                "source_person_id": None,
                "category": section,
                "role_group": group or section,
                "name": name,
                "summary": None,
                "education": education,
                "experience": experience,
                "avatar_url": avatar,
                "social_links": social_links(node),
            }
        )
    return records


def card_container(card: Node) -> Node:
    current = card
    while current.parent is not None:
        if {"col-12", "mb-5"}.issubset(current.classes()):
            return current
        current = current.parent
    return card


def parse_public_office_members(root: Node, source_url: str, source_file: str) -> list[dict[str, object]]:
    section = text_of(first(root, class_name="current_title"))
    records: list[dict[str, object]] = []
    for card in descendants(root, class_name="card"):
        title = first(card, class_name="card-title")
        anchor = first(title, tag="a") if title else None
        name = text_of(anchor or title)
        if not name:
            continue
        container = card_container(card)
        detail_url = anchor.attrs.get("href", "") if anchor else ""
        identifier_match = re.search(r"/memberdetail/([^/]+/[^/?#]+)", detail_url)
        image = first(container, tag="img")
        records.append(
            {
                "source_file": source_file,
                "source_url": source_url,
                "source_person_url": detail_url or source_url,
                "source_person_id": identifier_match.group(1) if identifier_match else None,
                "category": section,
                "role_group": section,
                "name": name,
                "summary": "；".join(normalized_lines(first(card, class_name="card-text"))) or None,
                "education": [],
                "experience": [],
                "avatar_url": image.attrs.get("src") if image else None,
                "social_links": social_links(card),
            }
        )
    return records


def source_url_from_html(raw_html: str) -> str:
    match = re.search(r"saved from url=\(\d+\)(https?://[^ ]+)\s*-->", raw_html)
    return match.group(1) if match else ""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    records: list[dict[str, object]] = []
    sources: list[dict[str, str]] = []
    for path in sorted(args.source_dir.glob("*.html")):
        raw_html = path.read_text(encoding="utf-8")
        source_url = source_url_from_html(raw_html)
        tree = TreeParser()
        tree.feed(raw_html)
        extracted = (
            parse_public_office_members(tree.root, source_url, path.name)
            if "/memberppl/" in source_url
            else parse_party_members(tree.root, source_url, path.name)
        )
        sources.append({"file": path.name, "url": source_url, "records": str(len(extracted))})
        records.extend(extracted)

    payload = {
        "source_name": "台灣民眾黨：現任黨公職",
        "observed_date": "2026-07-26",
        "sources": sources,
        "records": records,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(records)} records from {len(sources)} HTML snapshots to {args.output}")


if __name__ == "__main__":
    main()
