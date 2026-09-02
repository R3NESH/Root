"""Prompt-to-Plan: Natural language floor plan generator.

Accepts customer prompts (e.g., '30x40 North facing 2BHK with pooja room'),
extracts plot parameters and room requirements, solves the layout via CP-SAT,
and produces full architectural specifications, ASCII previews, JSON, and SVG blueprints.

Usage:
    python prompt_to_plan.py "30x40 north facing 2bhk with pooja"
    python prompt_to_plan.py "40x60 east facing 3bhk with dining and store" --svg plan.svg --json plan.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

# Ensure backend root is on sys.path when executed directly
_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from envelope import DEFAULT_SETBACK, FACINGS, Facing, Setback, buildable_envelope
from solver.model import PlacedRoom, SolveResult, solve_layout
from solver.rooms import ROOM_CATALOG, Room


@dataclass
class ParsedPrompt:
    plot_w_ft: float
    plot_d_ft: float
    facing: Facing
    room_names: list[str]
    apply_vaastu: bool
    raw_prompt: str


def parse_prompt(prompt: str) -> ParsedPrompt:
    """Parse natural language prompt into structured plot and room specifications.
    
    Works 100% offline with fast rule-based NLP extraction.
    """
    text = prompt.strip().lower()

    # 1. Extract Plot Dimensions
    # Matches: 30x40, 30*40, 30 by 40, 30 x 40, 30ft x 40ft, 30' x 40'
    dim_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:x|\*|by|\'|ft)?\s*(?:x|\*|by)?\s*(\d+(?:\.\d+)?)\s*(?:ft|\'|feet|m|meter)?", text)
    if dim_match:
        w_val = float(dim_match.group(1))
        d_val = float(dim_match.group(2))
    else:
        # Default standard Indian plot: 30x40 ft (1200 sqft)
        w_val, d_val = 30.0, 40.0

    # 2. Extract Facing Direction
    facing: Facing = "N"
    facing_patterns = [
        (r"\b(north\s*-\s*east|ne)\b", "NE"),
        (r"\b(north\s*-\s*west|nw)\b", "NW"),
        (r"\b(south\s*-\s*east|se)\b", "SE"),
        (r"\b(south\s*-\s*west|sw)\b", "SW"),
        (r"\b(north|north\s*facing|n\s*facing)\b", "N"),
        (r"\b(east|east\s*facing|e\s*facing)\b", "E"),
        (r"\b(south|south\s*facing|s\s*facing)\b", "S"),
        (r"\b(west|west\s*facing|w\s*facing)\b", "W"),
    ]
    for pattern, face_code in facing_patterns:
        if re.search(pattern, text):
            facing = face_code
            break

    # 3. Extract BHK / Room Mix
    rooms: list[str] = []

    bhk_match = re.search(r"(\d+)\s*(?:bhk|bed|bedroom)", text)
    bhk_count = int(bhk_match.group(1)) if bhk_match else 2  # Default to 2BHK

    if bhk_count == 1:
        rooms = ["hall", "kitchen", "bedroom", "bathroom"]
    elif bhk_count == 2:
        rooms = ["hall", "dining", "kitchen", "bedroom", "bedroom", "bathroom", "bathroom"]
    elif bhk_count == 3:
        rooms = ["hall", "dining", "kitchen", "bedroom", "bedroom", "bedroom", "bathroom", "bathroom"]
    elif bhk_count >= 4:
        rooms = ["hall", "dining", "kitchen", "bedroom", "bedroom", "bedroom", "bedroom", "bathroom", "bathroom", "bathroom"]

    # Check for explicit room additions / modifications
    if re.search(r"\b(pooja|puja|mandir|prayer)\b", text) and "pooja" not in rooms:
        rooms.append("pooja")

    if re.search(r"\b(store|storage|pantry)\b", text) and "store" not in rooms:
        rooms.append("store")

    if re.search(r"\b(dining)\b", text) and "dining" not in rooms:
        rooms.insert(1, "dining")

    if re.search(r"\b(entrance|foyer)\b", text) and "entrance" not in rooms:
        rooms.insert(0, "entrance")

    # 4. Vaastu compliance
    apply_vaastu = True
    if re.search(r"\b(no\s*vaastu|ignore\s*vaastu|without\s*vaastu|no\s*vastu)\b", text):
        apply_vaastu = False

    return ParsedPrompt(
        plot_w_ft=w_val,
        plot_d_ft=d_val,
        facing=facing,
        room_names=rooms,
        apply_vaastu=apply_vaastu,
        raw_prompt=prompt,
    )


def format_inches(inches: int) -> str:
    """Format inches as feet and inches (e.g., 144 -> 12'0")."""
    feet = inches // 12
    rem = inches % 12
    return f"{feet}'{rem}\"" if rem else f"{feet}'0\""


def generate_svg_blueprint(
    plot_w_in: int,
    plot_d_in: int,
    facing: str,
    env_origin_x: int,
    env_origin_z: int,
    env_w: int,
    env_d: int,
    rooms: list[PlacedRoom],
    title: str = "Architectural Floor Plan",
) -> str:
    """Generate high-quality vector SVG blueprint."""
    margin = 80
    scale = 1.2
    svg_w = int((plot_w_in + margin * 2) * scale)
    svg_h = int((plot_d_in + margin * 2) * scale)

    def tx(x: float) -> float:
        return (x + margin) * scale

    def ty(y: float) -> float:
        return (y + margin) * scale

    room_colors = {
        "hall": "#EBF4FF",
        "dining": "#FEF3C7",
        "kitchen": "#FEE2E2",
        "bedroom": "#EDE9FE",
        "bathroom": "#E0F2FE",
        "pooja": "#FEF9C3",
        "store": "#F3F4F6",
        "entrance": "#ECFDF5",
    }

    elements = []

    # Title & Header
    elements.append(
        f'<text x="{tx(0)}" y="40" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1E293B">{title}</text>'
    )
    elements.append(
        f'<text x="{tx(0)}" y="62" font-family="Arial, sans-serif" font-size="12" fill="#64748B">'
        f'Plot: {format_inches(plot_w_in)} x {format_inches(plot_d_in)} | Facing: {facing} | Built Envelope: {format_inches(env_w)} x {format_inches(env_d)}'
        f'</text>'
    )

    # Compass Rose
    cx_pos = svg_w - 60
    cy_pos = 50
    elements.append(f'<g transform="translate({cx_pos},{cy_pos})">')
    elements.append('<circle r="22" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1"/>')
    elements.append('<polygon points="0,-18 5,-2 0,-6 -5,-2" fill="#EF4444"/>')
    elements.append('<polygon points="0,18 5,2 0,6 -5,2" fill="#94A3B8"/>')
    elements.append('<text x="0" y="-8" text-anchor="middle" font-family="Arial" font-size="9" font-weight="bold" fill="#EF4444">N</text>')
    elements.append('</g>')

    # Plot Boundary (dashed)
    elements.append(
        f'<rect x="{tx(0)}" y="{ty(0)}" width="{plot_w_in * scale}" height="{plot_d_in * scale}" '
        f'fill="#FAFAFA" stroke="#94A3B8" stroke-width="2" stroke-dasharray="6,4"/>'
    )

    # Setback / Envelope Boundary
    elements.append(
        f'<rect x="{tx(env_origin_x)}" y="{ty(env_origin_z)}" width="{env_w * scale}" height="{env_d * scale}" '
        f'fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>'
    )

    # Rooms
    for r in rooms:
        rx = tx(env_origin_x + r.x_in)
        ry = ty(env_origin_z + r.y_in)
        rw = r.w_in * scale
        rd = r.d_in * scale
        bg_color = room_colors.get(r.name, "#F8FAFC")

        elements.append(
            f'<rect x="{rx}" y="{ry}" width="{rw}" height="{rd}" '
            f'fill="{bg_color}" stroke="#1E293B" stroke-width="{max(1.5, (r.wall_thickness_in or 5) * 0.3)}"/>'
        )

        # Room label and dimensions
        label = r.name.upper()
        dim_str = f"{format_inches(r.w_in)} x {format_inches(r.d_in)}"
        elements.append(
            f'<text x="{rx + rw / 2}" y="{ry + rd / 2 - 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0F172A">{label}</text>'
        )
        elements.append(
            f'<text x="{rx + rw / 2}" y="{ry + rd / 2 + 12}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#475569">{dim_str}</text>'
        )

    # Openings (Doors & Windows)
    for r in rooms:
        for op in r.openings:
            kind = op.get("kind")
            edge = op.get("edge")
            offset = op.get("offset_in", 0)
            width = op.get("width_in", 36)

            # Calculate door/window coordinates
            if edge == "N":
                ox = tx(env_origin_x + r.x_in + offset)
                oy = ty(env_origin_z + r.y_in)
                ow = width * scale
                oh = 4
            elif edge == "S":
                ox = tx(env_origin_x + r.x_in + offset)
                oy = ty(env_origin_z + r.y_in + r.d_in) - 2
                ow = width * scale
                oh = 4
            elif edge == "W":
                ox = tx(env_origin_x + r.x_in)
                oy = ty(env_origin_z + r.y_in + offset)
                ow = 4
                oh = width * scale
            else:  # E
                ox = tx(env_origin_x + r.x_in + r.w_in) - 2
                oy = ty(env_origin_z + r.y_in + offset)
                ow = 4
                oh = width * scale

            if kind == "window":
                elements.append(
                    f'<rect x="{ox}" y="{oy}" width="{ow}" height="{oh}" fill="#38BDF8" stroke="#0284C7" stroke-width="1"/>'
                )
            else:  # door
                elements.append(
                    f'<rect x="{ox}" y="{oy}" width="{ow}" height="{oh}" fill="#F59E0B" stroke="#D97706" stroke-width="1"/>'
                )

    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_w} {svg_h}" width="{svg_w}" height="{svg_h}" style="background-color: #FFFFFF;">
    {chr(10).join(elements)}
</svg>"""
    return svg_content


def render_ascii_map(env_w_in: int, env_d_in: int, rooms: list[PlacedRoom]) -> str:
    """Render a text-based ASCII matrix preview of the floor plan."""
    cols = 40
    rows = 20
    grid = [["." for _ in range(cols)] for _ in range(rows)]

    for idx, r in enumerate(rooms):
        char = r.name[0].upper()
        x0 = int(r.x_in / env_w_in * (cols - 1))
        x1 = int((r.x_in + r.w_in) / env_w_in * (cols - 1))
        y0 = int(r.y_in / env_d_in * (rows - 1))
        y1 = int((r.y_in + r.d_in) / env_d_in * (rows - 1))

        for y in range(max(0, y0), min(rows, y1 + 1)):
            for x in range(max(0, x0), min(cols, x1 + 1)):
                if y == y0 or y == y1 or x == x0 or x == x1:
                    grid[y][x] = "+"
                else:
                    grid[y][x] = char

    border = "+" + "-" * cols + "+"
    lines = [border]
    for row in grid:
        lines.append("|" + "".join(row) + "|")
    lines.append(border)
    return "\n".join(lines)


def solve_from_prompt(
    prompt_text: str,
    custom_setback: Setback | None = None,
) -> dict[str, Any]:
    """Complete end-to-end prompt solver pipeline."""
    parsed = parse_prompt(prompt_text)

    plot_w_in = round(parsed.plot_w_ft * 12)
    plot_d_in = round(parsed.plot_d_ft * 12)
    setback = custom_setback or DEFAULT_SETBACK

    env = buildable_envelope(plot_w_in, plot_d_in, parsed.facing, setback)

    # Validate room instances from catalog
    room_instances: list[Room] = []
    for name in parsed.room_names:
        if name in ROOM_CATALOG:
            room_instances.append(ROOM_CATALOG[name])
        else:
            # Fallback for unrecognized room
            room_instances.append(Room(name, 96, 144, 96, 144))

    result = solve_layout(
        env_w_in=env.width_in,
        env_d_in=env.depth_in,
        rooms=room_instances,
        apply_vaastu=parsed.apply_vaastu,
    )

    placed_rooms = list(result.rooms)
    entrance_edge = result.entrance_edge
    rooms_reachable = result.rooms_reachable

    output_payload = {
        "prompt": parsed.raw_prompt,
        "plot": {
            "w_ft": parsed.plot_w_ft,
            "d_ft": parsed.plot_d_ft,
            "w_in": plot_w_in,
            "d_in": plot_d_in,
            "facing": parsed.facing,
            "area_sqft": round(parsed.plot_w_ft * parsed.plot_d_ft),
        },
        "envelope": {
            "origin_x_in": env.origin_x_in,
            "origin_z_in": env.origin_z_in,
            "width_in": env.width_in,
            "depth_in": env.depth_in,
            "width_ft": round(env.width_in / 12, 1),
            "depth_ft": round(env.depth_in / 12, 1),
        },
        "meta": {
            "status": result.status,
            "solve_ms": round(result.solve_ms, 2),
            "vaastu_constraints_applied": result.vaastu_constraints_applied,
            "vaastu_relaxed": result.vaastu_relaxed,
            "entrance_edge": entrance_edge,
            "rooms_reachable": rooms_reachable,
            "room_count": len(placed_rooms),
        },
        "rooms": [
            {
                "name": r.name,
                "x_in": r.x_in,
                "y_in": r.y_in,
                "w_in": r.w_in,
                "d_in": r.d_in,
                "dim_formatted": f"{format_inches(r.w_in)} x {format_inches(r.d_in)}",
                "wall_thickness_in": r.wall_thickness_in,
                "habitable": r.habitable,
                "wet": r.wet,
                "openings": r.openings,
            }
            for r in placed_rooms
        ],
    }

    return {
        "data": output_payload,
        "svg": generate_svg_blueprint(
            plot_w_in,
            plot_d_in,
            parsed.facing,
            env.origin_x_in,
            env.origin_z_in,
            env.width_in,
            env.depth_in,
            placed_rooms,
            title=f"Plan: {parsed.raw_prompt}",
        )
        if result.status in ("OPTIMAL", "FEASIBLE")
        else "",
        "ascii": render_ascii_map(env.width_in, env.depth_in, placed_rooms)
        if result.status in ("OPTIMAL", "FEASIBLE")
        else "",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Prompt-to-Plan: Natural language floor plan generator")
    parser.add_argument("prompt", nargs="?", help="Natural language prompt describing plot and house requirements")
    parser.add_argument("--json", dest="json_out", help="Save output JSON payload to file")
    parser.add_argument("--svg", dest="svg_out", help="Save architectural SVG blueprint to file")

    args = parser.parse_args()

    prompt_text = args.prompt
    if not prompt_text:
        print("Enter your house requirement prompt (e.g. '30x40 North facing 2BHK with pooja'):")
        prompt_text = input("> ").strip()

    if not prompt_text:
        print("No prompt provided. Exiting.")
        sys.exit(1)

    print(f"\n[Processing Prompt] '{prompt_text}'...")
    res = solve_from_prompt(prompt_text)
    data = res["data"]
    meta = data["meta"]

    print("\n" + "=" * 60)
    print("FLOOR PLAN GENERATION REPORT")
    print("=" * 60)
    print(f"Status:       {meta['status']} ({meta['solve_ms']} ms)")
    print(f"Plot Size:    {data['plot']['w_ft']} ft x {data['plot']['d_ft']} ft ({data['plot']['area_sqft']} sqft)")
    print(f"Facing:       {data['plot']['facing']}")
    print(f"Envelope:     {data['envelope']['width_ft']} ft x {data['envelope']['depth_ft']} ft")
    print(f"Vaastu:       {'Compliant (' + ', '.join(meta['vaastu_constraints_applied']) + ')' if meta['vaastu_constraints_applied'] else 'None'}")
    print(f"Reachability: {meta['rooms_reachable']}/{meta['room_count']} rooms connected")
    print("-" * 60)
    print(f"{'ROOM':<12} | {'DIMENSIONS':<14} | {'LOCATION (X, Y)':<18} | {'WALL':<6}")
    print("-" * 60)
    for r in data["rooms"]:
        loc_str = f"({r['x_in']}\", {r['y_in']}\")"
        print(f"{r['name'].capitalize():<12} | {r['dim_formatted']:<14} | {loc_str:<18} | {r['wall_thickness_in']}\"")
    print("-" * 60)

    if res["ascii"]:
        print("\n[Layout Matrix Preview]")
        print(res["ascii"])

    if args.json_out:
        Path(args.json_out).write_text(json.dumps(data, indent=2), encoding="utf-8")
        print(f"\n[Saved JSON] -> {args.json_out}")

    if args.svg_out and res["svg"]:
        Path(args.svg_out).write_text(res["svg"], encoding="utf-8")
        print(f"[Saved SVG Blueprint] -> {args.svg_out}")


if __name__ == "__main__":
    main()
