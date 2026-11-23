import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source=readFileSync(new URL('../../.github/workflows/upload-s3.yml',import.meta.url),'utf8');
function assertForkRetired(s){
 assert.match(s,/^permissions:\n  contents: read$/m);
 assert.match(s,/^jobs:\n  publication-disabled-on-fork:\n    if: github\.repository == 'trustwallet\/assets'$/m);
 assert.match(s,/^on:\n  workflow_dispatch:$/m);
 assert.doesNotMatch(s,/\bid-token:\s*write\b|\bcontents:\s*write\b|configure-aws-credentials|\brole-to-assume\b|\baws\s+s3\b|secrets\.|\bpush:\b|pull_request_target:|\bgit push\b/);
 return repository => repository === 'trustwallet/assets';
}
test('fork cannot execute credential issuance or publisher; only original exact repo enters inert marker',()=>{
 const exact=assertForkRetired(source);
 for(const value of ['marchzmallow/assets','trustwallet/assets-copy','someone/another'])assert.equal(exact(value),false);
 assert.equal(exact('trustwallet/assets'),true);
});
test('mutation: restore OIDC permission rejected',()=>assert.throws(()=>assertForkRetired(source.replace('contents: read','id-token: write'))));
test('mutation: introduce AWS credential action rejected',()=>assert.throws(()=>assertForkRetired(source+"\n      - uses: aws-actions/configure-aws-credentials@v2\n")));
test('mutation: broaden repository job guard rejected',()=>assert.throws(()=>assertForkRetired(source.replace("github.repository == 'trustwallet/assets'","github.repository_owner == 'trustwallet'"))));
test('mutation: introduce cloud secret rejected',()=>assert.throws(()=>assertForkRetired(source+"\n      - run: echo ${{ secrets.AWS_ROLE_TO_ASSUME }}\n")));
test('mutation: publish on push rejected',()=>assert.throws(()=>assertForkRetired(source.replace('workflow_dispatch:',"push:\n    branches: [master]"))));
