import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDetailedTask } from '../src/lib/server/taskDetails.ts';
import { detailedTask } from './fixtures/detailed-task.js';

test('brief lengkap mempertahankan seluruh instruksi dalam description tanpa pemotongan', () => {
	const source = detailedTask();
	const task = parseDetailedTask(source);
	assert.ok(task.description.length > 2000);
	assert.ok(task.description.includes(source.details.verification[2]));
	assert.ok(task.description.includes(source.details.deliverables[1]));
	assert.equal(task.priority, 'high');
});

test('brief satu kalimat, kriteria kosong, duplikasi, dan ukuran berlebihan ditolak', () => {
	assert.throws(
		() => parseDetailedTask({ title: 'Singkat', description: 'Buat fiturnya.' }),
		/terlalu singkat/
	);
	const missing = detailedTask();
	missing.details.acceptanceCriteria = [];
	assert.throws(() => parseDetailedTask(missing), /minimal 4/);
	const repeated = detailedTask();
	repeated.details.implementation[1] = repeated.details.implementation[0];
	assert.throws(() => parseDetailedTask(repeated), /berulang/);
	const huge = detailedTask();
	huge.details.goal = 'x'.repeat(2001);
	assert.throws(() => parseDetailedTask(huge), /tujuan/);
});
