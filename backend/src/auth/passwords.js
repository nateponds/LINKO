import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function parsePasswordHash(passwordHash) {
  const parts = passwordHash.split("$");
  if (parts.length !== 5 || parts[1] !== "scrypt") {
    return null;
  }

  const [lnPart, rPart, pPart] = parts[2].split(",");
  if (!lnPart || !rPart || !pPart) {
    return null;
  }

  const ln = Number.parseInt(lnPart.replace("ln=", ""), 10);
  const r = Number.parseInt(rPart.replace("r=", ""), 10);
  const p = Number.parseInt(pPart.replace("p=", ""), 10);

  if (!Number.isInteger(ln) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return null;
  }

  return {
    salt: Buffer.from(parts[3], "base64"),
    derivedKey: Buffer.from(parts[4], "base64"),
    params: {
      N: 2 ** ln,
      r,
      p,
    },
  };
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return `$scrypt$ln=14,r=8,p=1$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
}

export async function verifyPassword(password, passwordHash) {
  const parsed = parsePasswordHash(passwordHash);
  if (!parsed) {
    return false;
  }

  const candidateKey = await scrypt(password, parsed.salt, parsed.derivedKey.length, parsed.params);
  if (candidateKey.length !== parsed.derivedKey.length) {
    return false;
  }

  return timingSafeEqual(candidateKey, parsed.derivedKey);
}
