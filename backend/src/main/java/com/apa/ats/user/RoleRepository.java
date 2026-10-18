package com.apa.ats.user;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RoleRepository extends JpaRepository<Role, Long> {

    Optional<Role> findByCode(String code);

    List<Role> findAllByOrderBySortOrderAsc();

    /** Role id → number of active users holding it. */
    @Query("select r.id, count(u) from AtsUser u join u.roles r where u.active = true group by r.id")
    List<Object[]> activeUserCounts();

    /** Users holding the role, active or not. */
    @Query("select count(u) from AtsUser u join u.roles r where r.id = ?1")
    long userCount(Long roleId);
}
