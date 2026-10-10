import { today, type Booking, type State } from "./types";
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

  page.drawText(booking.club.toUpperCase(), {x: 58,y,font:bold,size:16});
  y-=28;
  line("Date: "+today());
  line("From: Student Coordinator,");
  line("PSG Tech");
  y-=8;
  line("To: The Program Coordinator,",12,true);
  line("PSG Tech");
  y-=8;
  line("Subject: Permission to use a classroom for a club event",12,true);
  y-=8;
  line("Respected Sir/Madam,");
  line("I, "+booking.organizer+", on behalf of "+booking.club+", kindly request permission to conduct "+booking.event+" in Room "+(state.rooms.find(r=>r.id===booking.roomId)?.number ?? "")+" on "+booking.date+", from "+booking.start+" to "+booking.end+" (IST), for "+booking.participants+" participants.");
  y-=8;
  line("Purpose: "+booking.purpose);
  line("Block: "+(state.rooms.find(r=>r.id===booking.roomId)?.block ?? ""));
  line("Facilities Required: "+(Object.entries(booking.resources).filter(([,count])=>count>0).map(([name])=>name.replaceAll("_"," ")).join(", ") || "Standard classroom"));
  line("Faculty Advisor: "+booking.coordinator);
  line("We assure you that all college rules will be followed, the facilities will be used responsibly, and the classroom will be left clean and in good condition after the event.");
  y-=12;
  line("Kindly grant us permission for the above request.");
  y-=35;
  page.drawText("________________________",{x:58,y,font,size:11});
  page.drawText("________________________",{x:330,y,font,size:11});
  y-=25;
  page.drawText("Student Head",{x:58,y,font,size:11});
  page.drawText("Faculty Advisor",{x:330,y,font,size:11});
  y-=35;
  page.drawText("Reference: "+booking.reference,{x:180,y,font,size:10});
  const bytes = await pdf.save();
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = booking.reference + "-permission-letter.pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
