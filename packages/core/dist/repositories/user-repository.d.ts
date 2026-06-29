import type { Knex } from 'knex';
import type { User, NewUser } from '../domain/user.js';
export declare class UserRepository {
    private readonly db;
    constructor(db: Knex);
    findByEmail(email: string): Promise<User | undefined>;
    findById(id: string): Promise<User | undefined>;
    countAll(): Promise<number>;
    /**
     * Records that a user affirmatively accepted the Terms of Service at signup.
     * Idempotent-safe: callers invoke this once inside the signup transaction.
     */
    recordTermsAcceptance(userId: string, version: string): Promise<void>;
    create(user: NewUser): Promise<User>;
}
//# sourceMappingURL=user-repository.d.ts.map