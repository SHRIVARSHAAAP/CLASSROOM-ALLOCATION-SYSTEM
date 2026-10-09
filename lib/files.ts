import type { Booking, State } from "./types";
export function csv(rows: unknown[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let text = String(cell ?? "");
          if (/^[=+@\-]/.test(text)) text = "'" + text;
          return '"' + text.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
export function download(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function letter(booking: Booking, state: State) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 790;
  function line(text: string, size = 11, strong = false) {
    const words = text.replace(/[^\x20-\x7E]/g, " ").split(/\s+/);
    let buffer = "";
    function write() {
      if (y < 85) {
        page = pdf.addPage([595.28, 841.89]);
        y = 790;
      }
      page.drawText(buffer, {
        x: 58,
        y,
        size,
        font: strong ? bold : font,
        color: rgb(0.1, 0.18, 0.4),
      });
      y -= size + 9;
      buffer = "";
    }
    for (const word of words) {
      if (font.widthOfTextAtSize(buffer + " " + word, size) > 478 && buffer)
        write();
      buffer += (buffer ? " " : "") + word;
    }
    if (buffer) write();
  }
  line("PSG COLLEGE OF TECHNOLOGY", 18, true);
  line("Department of " + booking.department, 12);
  line("SAMPLE PERMISSION LETTER - FOR REVIEW", 9, true);
  y -= 20;
  line("To the Head of Department", 12, true);
  line("Subject: Permission to use a classroom for " + booking.event, 12, true);
  line("Reference: " + booking.reference);
  y -= 12;
  line("Respected Sir / Madam,");
  line(
    `On behalf of ${booking.club}, I request permission to conduct ${booking.event}.`,
  );
  line("Purpose: " + booking.purpose);
  line("Organizer: " + booking.organizer);
  line("Faculty coordinator: " + booking.coordinator);
  line("Room: " + state.rooms.find((r) => r.id === booking.roomId)?.number);
  line(`Date: ${booking.date}  Time: ${booking.start} - ${booking.end} IST`);
  line("Expected participants: " + booking.participants);
  line(
    "Required facilities: " +
      (Object.entries(booking.resources)
        .filter(([, count]) => count > 0)
        .map(([name, count]) => name.replaceAll("_", " ") + " (" + count + ")")
        .join(", ") || "Standard classroom"),
  );
  line(
    "We will follow college rules and leave the classroom in good condition.",
  );
  y -= 20;
  line("Organizer signature: __________________________");
  line("HOD signature: _______________________________");
  line("Date: _________________      Seal: _________________");
  page.drawText(
    "Demo document. HOD signature does not automatically reserve a room.",
    { x: 58, y: 40, font, size: 9 },
  );
  const bytes = await pdf.save();
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = booking.reference + "-HOD.pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
