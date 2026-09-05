# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is an Indian driver or rider with an Android phone who is frustrated by road conditions and wants a concrete way to contribute during an ordinary journey. Secondary audiences include citizens who may share the movement, journalists examining road evidence, and public institutions evaluating the emerging dataset.

## Product Purpose

BetterRoads turns phones into a distributed road-sensing network. A contributor mounts the phone, manually starts a journey, selects the vehicle, and drives normally with the app open. Accepted movement data scores road quality and updates a public map. Success means more citizens recording valid journeys so public road evidence becomes broad and difficult to ignore.

## Positioning

BetterRoads turns the phone already travelling on a road into evidence: phone to proof, proof to public record, public record to pressure. It is a citizen movement powered by measurement, not a complaint form or a navigation app.

## Operating Context

The app supports Android 10 or newer. Recording is manual, foreground-only, India-only, and requires a mounted phone. Vehicle selection remains manual. The website explains the movement, distributes the signed APK, and exposes the public road-quality map.

## Capabilities and Constraints

- The stable APK is distributed through `/downloads/BetterRoads.apk`; Google Play is not yet live.
- Recording scores GPS and motion only during confirmed movement, pauses at traffic stops, and queues valid journeys offline when necessary.
- Public totals are available from `/api/public/stats`; the network is early-stage and changes over time.
- National reach is an ambition, not a current impact claim.
- Background and screen-off recording are not available.
- `/map`, `/app`, privacy, terms, and mobile behavior must continue working.

## Brand Commitments

Preserve the BetterRoads name and the phone-to-proof-to-pressure mission. The homepage should feel like a bold citizen movement: collective, urgent, credible, and rooted in India without generic patriotic decoration. Existing tagline, palette, typography, and launch-era Independence Day framing are replaceable.

## Evidence on Hand

- A live public map and verified changing totals for accepted journeys, scored segments, recorded distance, and road events.
- A working Android app and signed APK with an honest three-step sensing workflow.
- Existing road photography and application/map interfaces that can be demonstrated.
- No verified testimonials, partner logos, government endorsements, press quotes, repair outcomes, or national impact statistics. Placeholder statistics must never ship as claims.

## Product Principles

- Turn frustration into a specific action a citizen can take today.
- Demonstrate the phone-to-proof mechanism before explaining it.
- Separate current evidence from future ambition visibly and honestly.
- Make participation feel collective without overstating network scale.
- Treat privacy, safe mounting, and data quality as sources of trust.

## Accessibility & Inclusion

Meet WCAG 2.2 AA, support keyboard and reduced-motion use, remain clear on low-end mobile devices, and avoid assuming English fluency in essential calls to action.
