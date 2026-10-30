import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

// A unique disposable database prevents tests from modifying the application database.
const databaseFile = path.join(tmpdir(), `internship_hub_test_${Date.now()}.sqlite`);
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = databaseFile;
process.env.NODE_ENV = 'test';
const { config } = await import('../src/config.js');
const { db, User, Student, Document } = await import('../src/db.js');
const { migrate } = await import('../src/migrations.js');
const { hashPassword } = await import('../src/security.js');
const { requirements } = await import('../../shared/contracts.js');
const { app } = await import('../src/app.js');

test('SQLite API: authentication, authorization and full internship lifecycle', async t => {
  assert.equal(config.dbDialect, 'sqlite');
  assert.equal(config.dbStorage, databaseFile);
  const server = app.listen(0,'127.0.0.1');
  await once(server,'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const adminPassword = 'Admin-Test-Password123';
  let adminCookie = '', studentCookie = '';
  const uploadFiles: string[] = [];
  async function request(route:string, method='GET', body?:unknown, cookie=adminCookie, headers:Record<string,string>={}) {
    const response = await fetch(base+route,{method,headers:{'X-Requested-With':'InternshipHub', ...(body instanceof FormData?{}:{'Content-Type':'application/json'}), ...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
    const text = await response.text(); let data; try { data=JSON.parse(text); } catch { data=text; }
    return { status:response.status,data,headers:response.headers };
  }
  try {
    await migrate(); await migrate();
    await User.create({name:'Test Admin',email:'admin@example.edu',role:'admin',passwordHash:await hashPassword(adminPassword)});
    await t.test('unauthenticated access, CSRF and incorrect role are rejected',async()=>{
      assert.equal((await request('/students')).status,401);
      assert.equal((await request('/auth/login','POST',{},'',{'X-Requested-With':''})).status,403);
      assert.equal((await request('/auth/login','POST',{},'',{Origin:'https://untrusted.example'})).status,403);
      assert.equal((await request('/auth/login','POST',{userId:'admin@example.edu',password:adminPassword,role:'student'})).status,401);
    });
    await t.test('login persists an HttpOnly session',async()=>{
      const login=await request('/auth/login','POST',{userId:'admin@example.edu',password:adminPassword,role:'admin',keepSignedIn:true});
      assert.equal(login.status,200,JSON.stringify(login.data));
      const cookie=login.headers.get('set-cookie')!; assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Max-Age=/i);adminCookie=cookie.split(';')[0];
      assert.equal((await request('/auth/me')).data.role,'admin');assert.equal(login.data.passwordHash,undefined);
    });
    const profile={id:'TEST-01',name:'Test Student',email:'student@example.edu',program:'BSIT',section:'4A',term:'Integration term',requiredHours:8,password:'Student-Password123'};
    let applicationId=0;
    await t.test('student creation is atomic and rejects duplicate email',async()=>{
      const created=await request('/students','POST',profile);assert.equal(created.status,201,JSON.stringify(created.data));
      assert.equal((await request('/students','POST',{...profile,id:'TEST-02'})).status,409);
      assert.equal(await Student.count(),1);
      const login=await request('/auth/login','POST',{userId:'TEST-01',password:profile.password,role:'student'},'');assert.equal(login.status,200);studentCookie=login.headers.get('set-cookie')!.split(';')[0];
      assert.equal((await request('/students','GET',undefined,studentCookie)).data.length,1);
      assert.equal((await request('/students/OTHER','GET',undefined,studentCookie)).status,403);
      assert.equal((await request('/dashboard','GET',undefined,studentCookie)).status,403);
      assert.equal((await request('/students','POST',profile,studentCookie)).status,403);
    });
    await t.test('applications create a placement only after admin review',async()=>{
      const created=await request('/applications','POST',{studentId:profile.id,organization:'Example Host',position:'Intern',appliedOn:'2026-01-01',status:'Completed'},studentCookie);
      assert.equal(created.status,201,JSON.stringify(created.data));assert.equal(created.data.status,'Applying');applicationId=created.data.id;
      assert.equal((await request(`/applications/${applicationId}`,'PATCH',{status:'Interning'},studentCookie)).status,403);
      assert.equal((await request(`/applications/${applicationId}`,'PATCH',{status:'Interning'})).status,200);
      const other=await request('/applications','POST',{studentId:profile.id,organization:'Other Host',position:'Intern',appliedOn:'2026-01-02'});
      assert.equal((await request(`/applications/${other.data.id}`,'PATCH',{status:'Accepted'})).status,409);
      assert.equal((await request(`/applications/${applicationId}`,'PATCH',{status:'Completed'})).status,409);
    });
    let hourId=0;
    await t.test('hour approval, daily limit and ownership are enforced',async()=>{
      assert.equal((await request('/hours','POST',{studentId:'OTHER',date:'2026-01-01',hours:8,description:'Test'},studentCookie)).status,403);
      const created=await request('/hours','POST',{studentId:profile.id,date:'2026-01-01',hours:8,description:'Developed a feature',status:'Approved'},studentCookie);
      assert.equal(created.status,201,JSON.stringify(created.data));assert.equal(created.data.status,'Pending');hourId=created.data.id;
      assert.equal((await request('/hours','POST',{studentId:profile.id,date:'2026-01-01',hours:17,description:'Excess hours'},studentCookie)).status,409);
      assert.equal((await request(`/hours/${hourId}`,'PATCH',{status:'Approved'},studentCookie)).status,403);
      assert.equal((await request(`/hours/${hourId}`,'PATCH',{status:'Approved'})).status,200);
      assert.equal((await request(`/students/${profile.id}`)).data.hoursDone,8);
    });
    let firstDoc=0;
    await t.test('file signatures, review, private downloads and requirement counts work',async()=>{
      const bad=new FormData();bad.set('studentId',profile.id);bad.set('requirement',requirements[0]);bad.set('file',new Blob(['<script>bad</script>'],{type:'application/pdf'}),'fake.pdf');
      assert.equal((await request('/documents','POST',bad,studentCookie)).status,400);
      for(const requirement of requirements){
        const form=new FormData();form.set('studentId',profile.id);form.set('requirement',requirement);form.set('file',new Blob(['%PDF-1.4\nTest fixture\n%%EOF'],{type:'application/pdf'}),'test.pdf');
        const uploaded=await request('/documents','POST',form,studentCookie);assert.equal(uploaded.status,201,JSON.stringify(uploaded.data));
        const id=uploaded.data.id;if(!firstDoc)firstDoc=id;
        assert.equal(uploaded.data.storageName,undefined);
        uploadFiles.push((await Document.findByPk(id))!.get('storageName') as string);
        assert.equal((await request(`/documents/${id}`,'PATCH',{status:'Verified'},studentCookie)).status,403);
        assert.equal((await request(`/documents/${id}`,'PATCH',{status:'Verified'})).status,200);
      }
      assert.equal((await request(`/documents/${firstDoc}/download`,'GET',undefined,'')).status,401);
      assert.equal((await request(`/documents/${firstDoc}/download`,'GET',undefined,studentCookie)).status,200);
      assert.equal((await request(`/students/${profile.id}`)).data.verifiedDocuments,8);
    });
    await t.test('completion is derived consistently and reports match the selected term',async()=>{
      assert.equal((await request(`/applications/${applicationId}`,'PATCH',{status:'Completed'})).status,200);
      assert.equal((await request(`/hours/${hourId}`,'PATCH',{status:'Rejected'})).status,409);
      assert.equal((await request(`/documents/${firstDoc}`,'PATCH',{status:'Rejected'})).status,409);
      assert.equal((await request(`/students/${profile.id}`,'PATCH',{...profile,requiredHours:16})).status,409);
      assert.equal((await request('/dashboard?term=Integration%20term')).data.completed,1);
      assert.equal((await request('/dashboard?term=Another%20term')).data.students,0);
      assert.match((await request('/reports/export?term=Integration%20term')).data,/Test Student/);
      assert.equal((await request('/follow-ups','POST',{studentId:profile.id,note:'Reviewed final progress'})).status,201);
      assert.equal((await request('/follow-ups')).data.length,1);
    });
    await t.test('concurrent placement and hour decisions remain consistent',async()=>{
      const otherProfile={...profile,id:'RACE-01',email:'race@example.edu',term:'Concurrency term'};
      assert.equal((await request('/students','POST',otherProfile)).status,201);
      const apps=await Promise.all(['One','Two'].map(organization=>request('/applications','POST',{studentId:otherProfile.id,organization,position:'Intern',appliedOn:'2026-01-01'})));
      const decisions=await Promise.all(apps.map(a=>request(`/applications/${a.data.id}`,'PATCH',{status:'Interning'})));
      assert.deepEqual(decisions.map(d=>d.status).sort(),[200,409]);
      const logs=await Promise.all([1,2].map(()=>request('/hours','POST',{studentId:otherProfile.id,date:'2026-01-01',hours:16,description:'Concurrent work entry'})));
      assert.deepEqual(logs.map(d=>d.status).sort(),[201,409]);
      const otherLogin=await request('/auth/login','POST',{userId:otherProfile.id,password:profile.password,role:'student'},'');
      const otherCookie=otherLogin.headers.get('set-cookie')!.split(';')[0];
      assert.equal((await request(`/documents/${firstDoc}/download`,'GET',undefined,otherCookie)).status,403);
    });
    await t.test('password assistance revokes existing sessions and logout invalidates cookies',async()=>{
      const known=await request('/auth/password-assistance','POST',{email:profile.email});
      const unknown=await request('/auth/password-assistance','POST',{email:'unknown@example.edu'});assert.deepEqual(known.data,unknown.data);
      const requests=await request('/admin/recovery-requests');assert.equal(requests.data.length,1);
      assert.equal((await request(`/admin/users/${requests.data[0].userId}/password`,'PATCH',{password:'Replacement-Password123'})).status,200);
      assert.equal((await request('/auth/me','GET',undefined,studentCookie)).status,401);
      assert.equal((await request('/admin/recovery-requests')).data.length,0);
      assert.equal((await request('/auth/logout','POST')).status,204);
      assert.equal((await request('/auth/me')).status,401);
    });
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    for(const file of uploadFiles) await unlink(path.join(config.uploadDir,file)).catch(()=>{});
    await db.close();
    // Only the unique database created by this test can reach this cleanup statement.
    for (const suffix of ['', '-journal', '-shm', '-wal']) await unlink(databaseFile + suffix).catch(() => {});
  }
});
