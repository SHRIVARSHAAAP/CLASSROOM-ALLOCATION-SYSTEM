import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { templatePayload, validWhatsappSignature, whatsappPhone } from "../lib/whatsapp";
describe("WhatsApp delivery protocol",()=>{
  it("requires country code and rejects invalid recipients",()=>{
    expect(whatsappPhone("+91 98765 43210")).toBe("+919876543210");
    for(const invalid of ["9876543210","+0123456789","+91abc",""]) expect(()=>whatsappPhone(invalid)).toThrow();
  });
  it("uses an approved template with one body parameter",()=>{
    const result=templatePayload("+919876543210","campus_update","en","Room changed","Class moved\n to K501");
    expect(result).toMatchObject({messaging_product:"whatsapp",to:"919876543210",type:"template",template:{name:"campus_update",language:{code:"en"}}});
    expect(result.template.components[0].parameters[0].text).toBe("Room changed: Class moved to K501");
  });
  it("verifies the raw callback body and rejects tampering",()=>{
    const raw='{"entry":[]}',secret="test-app-secret";
    const signature="sha256="+createHmac("sha256",secret).update(raw).digest("hex");
    expect(validWhatsappSignature(raw,signature,secret)).toBe(true);
    expect(validWhatsappSignature(raw+" ",signature,secret)).toBe(false);
    expect(validWhatsappSignature(raw,null,secret)).toBe(false);
    expect(validWhatsappSignature(raw,"sha256=bad",secret)).toBe(false);
    expect(validWhatsappSignature(raw,signature,"")).toBe(false);
  });
});
