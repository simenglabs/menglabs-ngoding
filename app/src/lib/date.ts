export function formatStoredDate(value: Date | string | number, withTime = false) {
	const date =
		typeof value === 'number'
			? new Date(value < 1_000_000_000_000 ? value * 1000 : value)
			: new Date(value);
	if (Number.isNaN(date.getTime())) return 'Tanggal tidak tersedia';
	return withTime ? date.toLocaleString('id-ID') : date.toLocaleDateString('id-ID');
}
