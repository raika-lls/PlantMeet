// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text,integer,primaryKey,index} from 'drizzle-orm/sqlite-core';
export const users=sqliteTable('users',{id:text('id').primaryKey(),name:text('name').notNull(),role:text('role').notNull(),created:integer('created').notNull()});
export const meetings=sqliteTable('meetings',{id:text('id').primaryKey(),owner:text('owner').notNull().references(()=>users.id),title:text('title').notNull(),date:text('date').notNull(),time:text('time').notNull(),kind:text('kind').notNull(),duration:integer('duration').notNull(),room:text('room').notNull(),closed:integer('closed'),created:integer('created').notNull()});
export const attendance=sqliteTable('attendance',{meeting:text('meeting').notNull().references(()=>meetings.id),user:text('user').notNull().references(()=>users.id),joined:integer('joined').notNull(),seen:integer('seen').notNull(),left:integer('left')},t=>[primaryKey({columns:[t.meeting,t.user]})]);
export const recordings=sqliteTable('recordings',{id:text('id').primaryKey(),meeting:text('meeting').notNull().references(()=>meetings.id),owner:text('owner').notNull().references(()=>users.id),created:integer('created').notNull(),expires:integer('expires').notNull(),size:integer('size').notNull()},t=>[index('recordings_expiry').on(t.expires)]);
