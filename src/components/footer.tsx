import Link from 'next/link';

export function Footer() {
    return (
        <footer className="border-t border-border bg-card">
            <div className="container mx-auto px-4 py-8 md:py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold">EA Market</h3>
                        <p className="text-sm text-muted-foreground">
                            แหล่งรวม Expert Advisors ระดับพรีเมียมสำหรับนักเทรดมืออาชีพ
                            ช่วยให้การเทรดของคุณเป็นอัตโนมัติด้วยอัลกอริทึมที่ผ่านการตรวจสอบแล้ว
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-3">สินค้า</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/" className="hover:text-foreground">Gold Scalper</Link></li>
                            <li><Link href="/" className="hover:text-foreground">Trend Hunter</Link></li>
                            <li><Link href="/" className="hover:text-foreground">Grid Master</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-3">ช่วยเหลือ</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#" className="hover:text-foreground">คู่มือการใช้งาน</Link></li>
                            <li><Link href="#" className="hover:text-foreground">วิธีการติดตั้ง</Link></li>
                            <li><Link href="#" className="hover:text-foreground">ติดต่อเรา</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-3">กฎหมาย</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#" className="hover:text-foreground">ข้อกำหนดการใช้งาน</Link></li>
                            <li><Link href="#" className="hover:text-foreground">นโยบายความเป็นส่วนตัว</Link></li>
                            <li><Link href="#" className="hover:text-foreground">คำเตือนความเสี่ยง</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="mt-8 pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
                    © {new Date().getFullYear()} EA Market. สงวนลิขสิทธิ์
                </div>
            </div>
        </footer>
    );
}
