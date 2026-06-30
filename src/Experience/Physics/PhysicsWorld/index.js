// ════════════════════════════════════════════════════════════
// index.js — تجميع أقسام عالم الفيزياء الأربعة بصف واحد.
// التقسيم منطقي حسب الدور، مش حسب ترتيب وثيقة خارجية:
//
//   PhysicsWorld.js  -> الثوابت + المنشئ + مصنع الأجسام + الحلقة الرئيسية
//   Kinematics.js    -> حركة الكرة: المسار/الحفرة + الاحتكاك + تكامل RK4
//   Collisions.js    -> حركة الدبابيس + حل التصادمات + ملامسة الأرضية
//   Simulation.js     -> تهيئة الرمية + مزامنة الرسوميات + إنهاء الرمية والنتيجة
//

// ════════════════════════════════════════════════════════════

import PhysicsWorldBase, { MainLoop } from './PhysicsWorld.js';
import Kinematics from './Kinematics.js';
import Collisions from './Collisions.js';
import Simulation from './Simulation.js';

export default class PhysicsWorld extends PhysicsWorldBase {}

Object.assign(
    PhysicsWorld.prototype,
    Kinematics,
    Collisions,
    Simulation,
    MainLoop
);
