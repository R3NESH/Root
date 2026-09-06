---
tags: [architecture, ui, decision]
status: implemented
date: 2026-09-06
---
# The ribbon had one tab doing five tabs' work

**Claim.** The top toolbar read as messy not because it was ugly but because it was mis-grouped.
One tab carried eleven panels into a shelf that fits four or five, so six of them collapsed into
anonymous drop-down buttons on every session. The fix was arrangement, not decoration.

## What a ribbon is supposed to be

Autodesk states the rule plainly: the ribbon "organizes and displays commands in logical grouping
using tabs and panels", where a **tab** is a phase of work and a **panel** is a small group of
related commands within it. AutoCAD's own Home tab is Draw, Modify, Annotation, Layers, Block,
Properties — six panels, all visible, none of them a mixed bag.

- [Autodesk — A Guide to AutoCAD Ribbon Customization](https://www.autodesk.com/blogs/autocad/a-guide-to-autocad-ribbon-customization/)
- [AutoCAD 2025 Help — Manage and Customize Your Workspace](https://help.autodesk.com/view/ACD/2025/ENU/?guid=GUID-1D87D5C3-21BC-499E-A560-79592348D47E)

## What was there

Four tabs, wildly unbalanced:

| Tab | Panels |
|---|---|
| Home | Building Type, Plot Dimensions, Plot Shape, Road Facing, Bye-Law, Floor Level, Room Program, Interiors & Sizing, CAD Drafting, Render Fidelity, Specs — **11** |
| Structure | Partition Walls, Curved Walls & Doors, Stairs, Doors, Window Styles, Window Spans, Fenestration Studio — **7** |
| Blueprints | Vastu Models, Blueprint Mode, CAD Export Suite — **3** |
| AI Prompt | one deck |

The panel-collapse mechanism in `TopRibbonTaskbar.tsx` was working exactly as designed — it keeps
the leading panels and gives the trailing ones to a labelled drop-down, which is AutoCAD's own
panel priority. It was being asked to hide half the application.

Home was also not one phase of work. The plot, the bye-law, the room mix, the drafting tools and
the render settings have nothing to do with each other except that they all ended up there.

## What it is now

Five command tabs, four or five panels each, plus the AI deck. Nothing collapses at a normal
window width.

| Tab | Panels | The phase |
|---|---|---|
| **Home** | Building Type, Plot Dimensions, Room Program, Floor Level, Vastu Models | Start a plan and say what is in it |
| **Site** | Plot Shape, Road Facing, Bye-Law, Specs | The plot, and what the law allows on it |
| **Draw** | CAD Drafting, Partition Walls, Curved Walls & Doors, Stairs | Putting geometry down by hand |
| **Openings** | Doors, Window Styles, Window Spans, Fenestration Studio | Every hole in a wall |
| **View** | Interiors & Sizing, Render Fidelity, Blueprint Mode, CAD Export Suite | How it is drawn, and what leaves the app |

No panel's contents changed. This is the same set of controls in a different arrangement, which
is why it was safe to do by moving whole JSX blocks.

> [!note] "Structure" is gone as a tab name
> Its id was `windows` and its label was *Structure*, and it held walls, stairs, doors and
> windows — the confusion [[three-pickers]] records, where a user could not find a door because
> the tab a door should live in is the one place it was not. Walls now live under **Draw** with
> the other things you place, and every opening lives under **Openings**.

## The left rail got the same treatment

`LeftToolRail.tsx` was one flat column of up to fifteen three-letter tags — SOF, BED, DIN, KIT,
DSK, PLT, MND, SAN, APP, LUM, SFT, STR, WAL — with a single divider before the last two. Finding
anything meant reading every button.

It is now clustered under headings, the same idea turned ninety degrees:

**Rooms** (Living, Bedroom, Dining, Kitchen, Study, Bathroom) · **Build** (Stairs, Dividers) ·
**Fit-out** (Lighting, Appliances) · **Dress** (Curtains, Decor, Mandir) ·
**Project** (Finishes, Manage)

A café's categories fall into the same five: covers and service are Rooms, back-of-house and the
terrace are Build, signage is Fit-out, decor is Dress. The programme still decides which
categories exist and their order inside a group — `lib/programs.ts` is unchanged.

### Then the tags went too

Grouping fixed the arrangement and left the vocabulary. A first-time user still met a column of
codes — SOF, MND, SAN, APP, LUM, SFT, PNT, MOD — that had to be learned before the rail was
usable, and labels cut to fit a 62px column: *Servic*, *Divide*, *Bed*, *Covers*, *Back*.

Each section now carries a drawn 16x16 glyph and its full word: Living, Bedroom, Dining, Kitchen,
Study, Bathroom, Stairs, Dividers, Lighting, Appliances, Curtains, Decor, Mandir, Finishes,
Manage. The rail went from 62px to 84px to fit them, and labels wrap rather than truncate.

> [!important] The glyph does not replace the word
> Nielsen Norman's finding is that outside a handful — home, print, search — icons are ambiguous
> and need a visible text label, and that the label must not be hidden behind hover, which costs
> an interaction and does not exist on touch. So every rail button shows both, always. The glyph
> is there to make a known button findable at a glance, not to explain it.
>
> - [NN/g — Icon Usability](https://www.nngroup.com/articles/icon-usability/)
> - [NN/g — Yes, Icons Need Text Labels](https://www.nngroup.com/videos/icon-text-labels/)

Two more first-run gaps closed: the rail says what it is for in one line — *Pick a category, then
drag a piece onto the plan* — because nothing about a column of buttons says they are drawers;
and the flyout header now shows the category name with its description underneath, where it used
to show the description alone and the name nowhere.

## What is still not done

The furniture items inside each drawer are still listed by name with the catalog's own short tag.
Whether they need thumbnails is a question about the catalog, not the rail.

**Links.** [[three-pickers]] · [[codebase-map]]
