import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

function esc(value) { return value.replace(/[\\()]/g, '\\$&'); }
function pdf(lines) {
  const stream = ['BT', '/F1 13 Tf', '72 740 Td', ...lines.flatMap((line, i) => [i ? '0 -22 Td' : '', `(${esc(line)}) Tj`]).filter(Boolean), 'ET'].join('\n');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let output = '%PDF-1.4\n'; const offsets=[0]; objects.forEach((item, index)=>{offsets.push(Buffer.byteLength(output));output+=`${index+1} 0 obj\n${item}\nendobj\n`;}); const start=Buffer.byteLength(output); output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return output;
}
const fixtures={
  'organization-a/Scholarship_Rules.pdf':['DEMONSTRATION DATA - Fictional University Scholarship Rules','Merit scholarship requires a minimum GPA of 8.0 and enrollment in second year or later.','Students already receiving a sports scholarship cannot combine it with the full merit scholarship.','Submit the scholarship application through the student portal before the published deadline.'],
  'organization-a/Admission_Policy.pdf':['DEMONSTRATION DATA - Fictional University Admission Policy','Applicants submit transcripts, identification, and the completed online application.','Admissions decisions are communicated by email after document verification.'],
  'organization-a/Fee_Structure.pdf':['DEMONSTRATION DATA - Fictional University Fee Structure','Tuition is billed per academic term. Contact the finance office for payment-plan questions.'],
  'organization-b/Patient_Guide.pdf':['DEMONSTRATION DATA - Fictional Hospital Patient Guide','Patients should bring photo identification and insurance documentation to registration.','For non-emergency questions, contact the patient support desk during business hours.'],
  'organization-b/Treatment_Policy.pdf':['DEMONSTRATION DATA - Fictional Hospital Treatment Policy','Treating clinicians explain treatment alternatives and document informed consent.','Emergency treatment follows clinical triage and applicable law.'],
  'organization-b/Billing_Rules.pdf':['DEMONSTRATION DATA - Fictional Hospital Billing Rules','Patients can request a written billing estimate before scheduled treatment.','Billing questions may be sent to the patient accounts office.']
};
for(const [file,lines] of Object.entries(fixtures)){const path=join('sample-data',file);await mkdir(dirname(path),{recursive:true});await writeFile(path,pdf(lines));}
console.log(`Generated ${Object.keys(fixtures).length} demonstration PDFs.`);
