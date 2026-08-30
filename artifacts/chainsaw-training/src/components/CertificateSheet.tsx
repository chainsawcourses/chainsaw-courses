import type { CertificateDetails } from "@workspace/api-client-react";

const ASSET_BASE = import.meta.env.BASE_URL;

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function nameSize(name: string) {
  if (name.length > 34) return 22;
  if (name.length > 25) return 27;
  return 34;
}

export function CertificateSheet({ certificate }: { certificate: CertificateDetails }) {
  const scoreLine = certificate.passedScore === null
    ? "Course Version 1.1 · July 2026"
    : `Assessment Score: ${certificate.passedScore}%  ·  Course Version 1.1 · July 2026`;

  return (
    <svg
      viewBox="0 0 595 842"
      role="img"
      aria-label={`Certificate of completion for ${certificate.fullName}`}
      className="block h-auto w-full bg-white shadow-2xl"
      xmlns="http://www.w3.org/2000/svg"
    >
      <image
        href={`${ASSET_BASE}bg.jpg`}
        x="0"
        y="0"
        width="595"
        height="842"
        preserveAspectRatio="xMidYMid slice"
      />
      <rect x="0" y="0" width="595" height="842" fill="#fff" fillOpacity="0.92" />

      <rect x="14" y="14" width="567" height="814" fill="none" stroke="#d1610d" strokeWidth="2.2" />
      <rect x="21" y="21" width="553" height="800" fill="none" stroke="#c7c7c7" strokeWidth="0.5" />

      <g fontFamily="Arial, Helvetica, sans-serif" textAnchor="middle">
        <text x="297.5" y="46" fontSize="11" fontWeight="700" fill="#595959">
          CHAINSAW COURSES  |  IIRSM Approved Course
        </text>
        <line x1="52" y1="64" x2="543" y2="64" stroke="#333" strokeOpacity="0.45" strokeWidth="0.8" />
        <image
          href={`${ASSET_BASE}iirsm-rosette-logo-transparent.png`}
          x="261.5"
          y="78"
          width="72"
          height="72"
          preserveAspectRatio="xMidYMid meet"
        />

        <text x="297.5" y="200" fontSize="20" fontWeight="700" fill="#141414">
          CERTIFICATE OF COMPLETION
        </text>
        <text x="297.5" y="235" fontSize="10" fontStyle="italic" fill="#595959">
          This is to certify that
        </text>
        <text
          x="297.5"
          y="280"
          fontSize={nameSize(certificate.fullName)}
          fontWeight="700"
          fill="#141414"
        >
          {certificate.fullName}
        </text>
        <text x="297.5" y="310" fontSize="9.5" fill="#949494">
          {certificate.email}
        </text>
        <text x="297.5" y="338" fontSize="9.5" fontStyle="italic" fill="#595959">
          has successfully completed the following IIRSM Approved Course:
        </text>

        <image
          href={`${ASSET_BASE}logo-transparent.png`}
          x="276.5"
          y="376"
          width="42"
          height="24"
          preserveAspectRatio="xMidYMid meet"
        />
        <text x="297.5" y="434" fontSize="22" fontWeight="700" fill="#141414">
          Chainsaw Maintenance &amp; Cross Cutting
        </text>
        <text x="297.5" y="478" fontSize="9" fill="#949494">
          Professional Training Course  ·  Theory &amp; Knowledge Assessment
        </text>

        <text x="297.5" y="516" fontSize="9.5" fontWeight="700" fill="#141414">
          Guided Learning Hours: 4  ·  CPD: 5 Verifiable CPD Points  ·  IIRSM Approved Course
        </text>
        <text x="297.5" y="535" fontSize="8.5" fill="#595959">
          Unit Ref: 0039-20  ·  Module Quizzes: 100%  ·  Final Exam Pass Mark: 80%
        </text>
        <text x="297.5" y="554" fontSize="9" fill="#595959">
          {scoreLine}
        </text>
        <text x="297.5" y="573" fontSize="8.5" fontStyle="italic" fill="#949494">
          International Institute of Risk and Safety Management
        </text>

        <line x1="52" y1="593" x2="543" y2="593" stroke="#949494" strokeOpacity="0.28" strokeWidth="0.6" />
        <text x="297.5" y="612" fontSize="10" fill="#595959">
          Date of Award:  {displayDate(certificate.passedAt)}
        </text>
        <text x="297.5" y="630" fontSize="8" fontStyle="italic" fill="#949494">
          It is recommended to refresh your certificate every 3-5 years
        </text>

        <image
          href={`${ASSET_BASE}signature_director.png`}
          x="212.5"
          y="656"
          width="170"
          height="42"
          preserveAspectRatio="xMidYMid meet"
        />
        <line x1="202.5" y1="702" x2="392.5" y2="702" stroke="#949494" strokeWidth="0.8" />
        <text x="297.5" y="718" fontSize="7.5" fill="#949494">
          Course Director
        </text>
        <image
          href={`${ASSET_BASE}iirsm-horizontal-logo-transparent.png`}
          x="239.5"
          y="722"
          width="116"
          height="48"
          preserveAspectRatio="xMidYMid meet"
        />

        <text x="297.5" y="784" fontSize="7" fill="#949494">
          Certificate Ref: {certificate.certificateReference}
        </text>
        <line x1="52" y1="798" x2="543" y2="798" stroke="#c7c7c7" strokeOpacity="0.6" strokeWidth="0.5" />
        <text x="297.5" y="812" fontSize="7.5" fill="#949494">
          chainsawcourses.com  |  IIRSM Approved Course
        </text>
      </g>
    </svg>
  );
}