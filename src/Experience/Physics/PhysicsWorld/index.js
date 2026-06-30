// ════════════════════════════════════════════════════════════
// index.js — تجميع كل أقسام عالم الفيزياء بنفس الترتيب الموجود
// بالوثيقة (Mathematical Specification Document):
//
//   00_Constructor.js              → الثوابت + المنشئ
//   01_RigidBodyFactory.js         → STRUCT RigidBody
//   02_InitializeSimulation.js     → مرحلة الإطلاق (Release Phase)
//   03_LaneAndGutterSystem.js      → نظام المسار والحفر
//   04_FrictionAndAccelerations.js → الاحتكاك + Skid/Hook/Roll
//   05_RK4Integration.js           → التكامل العددي RK4
//   06_PinIntegration.js           → حركة الدبابيس
//   07_CollisionResolution.js      → فيزياء التصادم
//   08_GroundResolution.js         → تلامس الكرة بالأرضية
//   09_MeshSync.js                 → مزامنة Three.js
//   10_EndSimulation.js            → إنهاء الرمية + النقاط
//   11_MainLoop.js                 → الحلقة الرئيسية (update)
//
// هاد الملف هو نفس PhysicsWorld.js القديم تماماً بالمنطق،
// بس مقسّم لملفات لتسهيل القراءة والفهم. لتستخدمه بمشروعك
// بنفس مكان الملف القديم، إما:
//  (أ) خلي هاد المجلد باسم PhysicsWorld واستورد منه:
//      import PhysicsWorld from './Physics/PhysicsWorld/index.js'
//  (ب) أو خلي هاد الملف نفسه باسم PhysicsWorld.js إذا ما بدك مجلد فرعي
// ════════════════════════════════════════════════════════════

import PhysicsWorldBase        from './00_Constructor.js';
import RigidBodyFactory        from './01_RigidBodyFactory.js';
import InitializeSimulation    from './02_InitializeSimulation.js';
import LaneAndGutterSystem     from './03_LaneAndGutterSystem.js';
import FrictionAndAccelerations from './04_FrictionAndAccelerations.js';
import RK4Integration          from './05_RK4Integration.js';
import PinIntegration          from './06_PinIntegration.js';
import CollisionResolution     from './07_CollisionResolution.js';
import GroundResolution        from './08_GroundResolution.js';
import MeshSync                from './09_MeshSync.js';
import EndSimulation           from './10_EndSimulation.js';
import MainLoop                from './11_MainLoop.js';

export default class PhysicsWorld extends PhysicsWorldBase {}

Object.assign(
    PhysicsWorld.prototype,
    RigidBodyFactory,
    InitializeSimulation,
    LaneAndGutterSystem,
    FrictionAndAccelerations,
    RK4Integration,
    PinIntegration,
    CollisionResolution,
    GroundResolution,
    MeshSync,
    EndSimulation,
    MainLoop
);
