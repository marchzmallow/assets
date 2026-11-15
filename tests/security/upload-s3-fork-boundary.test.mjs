import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(
  new URL('../../.github/workflows/upload-s3.yml', import.meta.url),
  'utf8',
);

function verifyForkBoundary(source) {
  const job = source.match(/^jobs:\n  upload-s3:\n([\s\S]*)$/m);
  assert.ok(job, 'publisher job must exist');
  assert.match(
    job[1],
    /^    if: github\.repository == 'trustwallet\/assets'$/m,
    'whole job must be gated before the AWS credential step',
  );
  assert.match(source, /^permissions:\n  id-token: write$/m);
  assert.match(source, /^      - name: Confiugre AWS credentials$/m);
  assert.match(job[1], /^        if: github\.repository == 'trustwallet\/assets'$/m);
  assert.match(source, /USE_SIZE_ONLY: \$\{\{ github\.event\.inputs\['use-size-only'\] \}\}/);
  assert.match(source, /aws s3 sync \. "s3:\/\/\$AWS_S3_BUCKET" "\$\{sync_options\[@\]\}"/);
  assert.doesNotMatch(source, /\beval\s+|::set-output name=paths::\$\(/);
  assert.doesNotMatch(source, /^\s*pull_request_target:/m);

  return (repository) => repository === 'trustwallet/assets';
}

test('forks and unrelated repositories are denied before AWS OIDC configuration', () => {
  const allows = verifyForkBoundary(workflow);
  assert.equal(allows('trustwallet/assets'), true);
  for (const repository of [
    'marchzmallow/assets',
    'marchzmallow/trustwallet-assets',
    'trustwallet/assets-fork',
    'example/assets',
  ]) {
    assert.equal(allows(repository), false, repository);
  }
});

test('mutation: removing job-level gate fails', () => {
  const modified = workflow.replace("    if: github.repository == 'trustwallet/assets'", '');
  assert.throws(() => verifyForkBoundary(modified));
});

test('mutation: owner-only condition fails', () => {
  const modified = workflow.replace(
    "    if: github.repository == 'trustwallet/assets'",
    "    if: github.repository_owner == 'trustwallet'",
  );
  assert.throws(() => verifyForkBoundary(modified));
});

test('mutation: dynamic shell execution fails', () => {
  const modified = workflow.replace(
    'aws s3 sync . "s3://$AWS_S3_BUCKET" "${sync_options[@]}"',
    'eval "aws s3 sync . s3://$AWS_S3_BUCKET $SYNC_OPTIONS"',
  );
  assert.throws(() => verifyForkBoundary(modified));
});
