
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure that authority management works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get("deployer")!;
        const authority = accounts.get("wallet_1")!;

        let block = chain.mineBlock([
            Tx.contractCall(
                "passport-system",
                "add-authority",
                [
                    types.principal(authority.address),
                    types.utf8("Test Authority")
                ],
                deployer.address
            ),
            // Try to add same authority again
            Tx.contractCall(
                "passport-system",
                "add-authority",
                [
                    types.principal(authority.address),
                    types.utf8("Test Authority")
                ],
                deployer.address
            ),
            // Remove authority
            Tx.contractCall(
                "passport-system",
                "remove-authority",
                [types.principal(authority.address)],
                deployer.address
            )
        ]);

        assertEquals(block.receipts[0].result, '(ok true)');
        assertEquals(block.receipts[1].result, `(err u${3})`); // err-already-exists
        assertEquals(block.receipts[2].result, '(ok true)');
    }
});

Clarinet.test({
    name: "Ensure that passport issuance and validation works",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get("deployer")!;
        const authority = accounts.get("wallet_1")!;
        const holder = accounts.get("wallet_2")!;
        const passportId = "PASS123";

        // First add authority
        let block = chain.mineBlock([
            Tx.contractCall(
                "passport-system",
                "add-authority",
                [
                    types.principal(authority.address),
                    types.utf8("Test Authority")
                ],
                deployer.address
            )
        ]);

        // Issue passport
        block = chain.mineBlock([
            Tx.contractCall(
                "passport-system",
                "issue-passport",
                [
                    types.utf8(passportId),
                    types.principal(holder.address),
                    types.utf8("John Doe"),
                    types.uint(19900101),
                    types.utf8("USA"),
                    types.uint(52560), // validity period
                    types.none()
                ],
                authority.address
            )
        ]);

        assertEquals(block.receipts[0].result, '(ok true)');

        // Check validity
        let result = chain.callReadOnlyFn(
            "passport-system",
            "is-valid-passport?",
            [types.utf8(passportId)],
            deployer.address
        );

        assertEquals(result.result, 'true');
    }
});

Clarinet.test({
    name: "Ensure that emergency reporting and handling works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get("deployer")!;
        const authority = accounts.get("wallet_1")!;
        const holder = accounts.get("wallet_2")!;
        const passportId = "PASS123";

        // Setup: Add authority and issue passport
        let block = chain.mineBlock([
            Tx.contractCall(
                "passport-system",
                "add-authority",
                [
                    types.principal(authority.address),
                    types.utf8("Test Authority")
                ],
                deployer.address
            ),
            Tx.contractCall(
                "passport-system",
                "issue-passport",
                [
                    types.utf8(passportId),
                    types.principal(holder.address),
                    types.utf8("John Doe"),
                    types.uint(19900101),
                    types.utf8("USA"),
                    types.uint(52560),
                    types.none()
                ],
                authority.address
            ),
        ]);

        // Add emergency contact
        block = chain.mineBlock([
            Tx.contractCall(
                "passport-system",
                "add-emergency-contact",
                [
                    types.utf8(passportId),
                    types.utf8("Jane Doe"),
                    types.utf8("Spouse"),
                    types.utf8("123-456-7890")
                ],
                holder.address
            )
        ]);

        assertEquals(block.receipts[0].result, '(ok true)');

        // Report emergency
        block = chain.mineBlock([
            Tx.contractCall(
                "passport-system",
                "report-emergency",
                [
                    types.utf8(passportId),
                    types.utf8("Lost passport")
                ],
                holder.address
            )
        ]);

        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify passport is invalidated
        let result = chain.callReadOnlyFn(
            "passport-system",
            "is-valid-passport?",
            [types.utf8(passportId)],
            deployer.address
        );

        assertEquals(result.result, 'false');
    }
});

Clarinet.test({
    name: "Ensure that verification requests work properly",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get("deployer")!;
        const authority = accounts.get("wallet_1")!;
        const holder = accounts.get("wallet_2")!;
        const verifier = accounts.get("wallet_3")!;
        const passportId = "PASS123";

        // Setup
        let block = chain.mineBlock([
            Tx.contractCall(
                "passport-system",
                "add-authority",
                [
                    types.principal(authority.address),
                    types.utf8("Test Authority")
                ],
                deployer.address
            ),
            Tx.contractCall(
                "passport-system",
                "issue-passport",
                [
                    types.utf8(passportId),
                    types.principal(holder.address),
                    types.utf8("John Doe"),
                    types.uint(19900101),
                    types.utf8("USA"),
                    types.uint(52560),
                    types.none()
                ],
                authority.address
            )
        ]);

        // Request verification
        block = chain.mineBlock([
            Tx.contractCall(
                "passport-system",
                "request-verification",
                [
                    types.utf8(passportId),
                    types.utf8("Identity verification for employment")
                ],
                verifier.address
            )
        ]);

        assertEquals(block.receipts[0].result, '(ok true)');

        // Approve verification
        block = chain.mineBlock([
            Tx.contractCall(
                "passport-system",
                "approve-verification-request",
                [
                    types.utf8(passportId),
                    types.principal(verifier.address)
                ],
                holder.address
            )
        ]);

        assertEquals(block.receipts[0].result, '(ok true)');
    }
});

Clarinet.test({
    name: "Ensure that passport metadata updates work",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get("deployer")!;
        const authority = accounts.get("wallet_1")!;
        const holder = accounts.get("wallet_2")!;
        const passportId = "PASS123";

        // Setup
        let block = chain.mineBlock([
            Tx.contractCall(
                "passport-system",
                "add-authority",
                [
                    types.principal(authority.address),
                    types.utf8("Test Authority")
                ],
                deployer.address
            ),
            Tx.contractCall(
                "passport-system",
                "issue-passport",
                [
                    types.utf8(passportId),
                    types.principal(holder.address),
                    types.utf8("John Doe"),
                    types.uint(19900101),
                    types.utf8("USA"),
                    types.uint(52560),
                    types.none()
                ],
                authority.address
            )
        ]);

        // Update metadata
        block = chain.mineBlock([
            Tx.contractCall(
                "passport-system",
                "update-passport-metadata",
                [
                    types.utf8(passportId),
                    types.some(types.utf8("https://example.com/metadata"))
                ],
                authority.address
            )
        ]);

        assertEquals(block.receipts[0].result, '(ok true)');
    }
});
